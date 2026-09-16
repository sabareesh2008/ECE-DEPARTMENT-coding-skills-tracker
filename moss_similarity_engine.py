# =======================================================================
# CODEMETRIX MOSS & AST STRUCTURAL @CODE PLAGIARISM DETECTOR
# =======================================================================
# Standalone similarity engine using Abstract Syntax Tree (AST)
# and Winnowing Fingerprinting (the Stanford MOSS standard).
# Detects peer-to-peer code copying even if variable names, comments,
# or whitespace formatting are changed.
# =======================================================================

import re
import ast
import hashlib
import json
import os
import sys
import urllib.request
version = '1.0.0'

DEFAULT_SUPABASE_URL = 'https://bmbdkmtplemvlglqbgee.supabase.co'
DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_mhASvZVhm997qjKiVb15LQ_MiLPXsRl'

def tokenize_code(code: str, language: str = 'java') -> list:
    lang = (language or '').lower()
    if 'python' in lang:
        try:
            tree = ast.parse(code)
            tokens = []
            for node in ast.walk(tree):
                tokens.append(node.__class__.__name__)
            if len(tokens) > 5:
                return tokens
        except Exception:
            pass

    # Generic Language AST / Structural Tokenizer (Java, C++, JS, C, Python fallback)
    cleaned = re.sub(r'/\*.*?\*/', ' ', code, flags=re.DOTALL)
    cleaned = re.sub(r'//.*', ' ', cleaned)
    if 'python' in lang:
        cleaned = re.sub(r'#.*', ' ', cleaned)

    keywords = {
        'class', 'public', 'private', 'protected', 'static', 'final', 'void',
        'int', 'long', 'double', 'float', 'boolean', 'bool', 'char', 'string',
        'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default',
        'break', 'continue', 'return', 'new', 'this', 'super', 'import',
        'try', 'catch', 'finally', 'throw', 'throws', 'vector', 'map', 'set',
        'unordered_map', 'unordered_set', 'pair', 'queue', 'stack', 'priority_queue',
        'def', 'in', 'is', 'not', 'and', 'or', 'lambda', 'yield',
        'function', 'const', 'let', 'var'
    }

    raw_tokens = re.findall(r'[a-zA-Z_]\w*|[{}()\[\];,.<>+\-*/%&|^!=?:]', cleaned)
    normalized = []
    var_map = {}
    var_idx = 1

    for t in raw_tokens:
        t_low = t.lower()
        if t_low in keywords:
            normalized.append(t_low.upper())
        elif re.match(r'^[a-zA-Z_]\w*$', t):
            if t not in var_map:
                var_map[t] = f'VAR_{var_idx}'
                var_idx += 1
            normalized.append(var_map[t])
        else:
            normalized.append(t)
            
    return normalized

def generate_kgrams(tokens: list, k: int = 10) -> list:
    if len(tokens) < k:
        return [int(hashlib.md5(''.join(tokens).encode('utf-8')).hexdigest()[:8], 16)]
    
    hashes = []
    for i in range(len(tokens) - k + 1):
        kgram = ''.join(tokens[i:i+k])
        h = int(hashlib.md5(kgram.encode('utf-8')).hexdigest()[:8], 16)
        hashes.append(h)
    return hashes

def winnowing_fingerprints(hashes: list, w: int = 5) -> set:
    if len(hashes) <= w:
        return set(hashes)
    
    fingerprints = set()
    for i in range(len(hashes) - w + 1):
        window = hashes[i:i+w]
        min_val = min(window)
        fingerprints.add(min_val)
    return fingerprints

def compute_similarity(code_a: str, code_b: str, lang_a: str = 'Java', lang_b: str = 'Java') -> float:
    tokens_a = tokenize_code(code_a, lang_a)
    tokens_b = tokenize_code(code_b, lang_b)
    
    if not tokens_a or not tokens_b:
        return 0.0
    
    fp_a = winnowing_fingerprints(generate_kgrams(tokens_a))
    fp_b = winnowing_fingerprints(generate_kgrams(tokens_b))
    
    if not fp_a or not fp_b:
        return 0.0
        
    intersection = fp_a.intersection(fp_b)
    min_len = min(len(fp_a), len(fp_b))
    
    if min_len == 0:
        return 0.0
        
    similarity = (len(intersection) / min_len) * 100.0
    return round(similarity, 1)

def run_batch_plagiarism_analysis(problem_slug: str = None, min_threshold: float = 75.0):
    supabase_url = os.environ.get('SUPABASE_URL', DEFAULT_SUPABASE_URL)
    supabase_key = os.environ.get('SUPABASE_KEY', DEFAULT_SUPABASE_ANON_KEY)
    
    url = f'{supabase_url}/rest/v1/student_leetcode_submissions?select=id,register_number,leetcode_username,problem_title,problem_slug,language,source_code,submitted_at'
    if problem_slug:
        url += f'&problem_slug=eq.{problem_slug}'
        
    req = urllib.request.Request(url, headers={
        'apikey': supabase_key,
        'Authorization': f'Bearer {supabase_key}'
    })
    
    try:
        with urllib.request.urlopen(req) as resp:
            submissions = json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f'Error fetching submissions: {e}')
        return []

    print(f'Retrieved {len(submissions)} submitted solutions from Supabase.')
    
    by_problem = {}
    for s in submissions:
        sl = s.get('problem_slug')
        if sl not in by_problem:
            by_problem[sl] = []
        by_problem[sl].append(s)
        
    flagged_pairs = []
    for sl, subs in by_problem.items():
        if len(subs) < 2:
            continue
        print(f'Analyzing {len(subs)} submissions for problem: {sl}...')
        
        for i in range(len(subs)):
            for j in range(i + 1, len(subs)):
                s1 = subs[i]
                s2 = subs[j]
                
                if s1.get('register_number') == s2.get('register_number'):
                    continue
                    
                code1 = s1.get('source_code', '')
                code2 = s2.get('source_code', '')
                lang1 = s1.get('language', 'Java')
                lang2 = s2.get('language', 'Java')
                
                sim = compute_similarity(code1, code2, lang1, lang2)
                if sim >= min_threshold:
                    pair = {
                        'problem_slug': sl,
                        'problem_title': s1.get('problem_title'),
                        'student_1': s1.get('register_number'),
                        'user_1': s1.get('leetcode_username'),
                        'student_2': s2.get('register_number'),
                        'user_2': s2.get('leetcode_username'),
                        'similarity_pct': sim
                    }
                    r1 = s1.get('register_number')
                    r2 = s2.get('register_number')
                    print(f'🚨 [PLAGIARISM MATCH] {r1} <-> {r2}: {sim}% Similarity on {sl}')
    return flagged_pairs

if __name__ == '__main__':
    print('=== CodeMetrix MOSS / AST Similarity Engine Ready ===')
