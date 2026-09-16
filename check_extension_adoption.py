# =======================================================================
# CODEMETRIX EXTENSION ADOPTION & INSTALLATION AUDITOR
# =======================================================================
# Compares the master student roster (376 ECE students) against the
# extension_installed_students table in Supabase to find who has installed
# and who has NOT installed / activated the extension yet.
# =======================================================================

import os
import sys
import json
import urllib.request
from typing import Dict, List, Any

DEFAULT_SUPABASE_URL = 'https://bmbdkmtplemvlglqbgee.supabase.co'
DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_mhASvZVhm997qjKiVb15KQ_MiLPXsRl'

def load_roster() -> Dict[str, Dict[str, str]]:
    roster_path = os.path.join(os.path.dirname(__file__), 'extensions', 'codemetrix-sync', 'students_data.js')
    if not os.path.exists(roster_path):
        roster_path = os.path.join('extensions', 'codemetrix-sync', 'students_data.js')
        
    with open(roster_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    start = content.find('{')
    end = content.rfind('}')
    if start == -1 or end == -1:
        return {}
        
    json_str = content[start:end+1]
    return json.loads(json_str)

def get_installed_students() -> List[Dict[str, Any]]:
    supabase_url = os.environ.get('SUPABASE_URL', DEFAULT_SUPABASE_URL)
    supabase_key = os.environ.get('SUPABASE_KEY', DEFAULT_SUPABASE_ANON_KEY)
    
    url = f'{supabase_url}/rest/v1/extension_installed_students?select=*\ndesc'
    req = urllib.request.Request(url, headers={
        'apikey': supabase_key,
        'Authorization': f'Bearer {supabase_key}'
    })
    
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        return []

def audit_extension_adoption():
    roster = load_roster()
    if not roster:
        print('Could not load student roster.')
        return
        
    installed = get_installed_students()
    installed_regs = {str(item.get('register_number', '')).strip().upper(): item for item in installed}
    
    total_students = len(roster)
    total_installed = len(installed_regs)
    total_missing = total_students - total_installed
    adoption_pct = (total_installed / total_students * 100) if total_students > 0 else 0
    
    print('====================================================================')
    print('         CODEMETRIX EXTENSION INSTALLATION & ADOPTION AUDIT          ')
    print('====================================================================')
    print(f'Total Department Students : {total_students}')
    print(f'Extension Installed       : {total_installed} ({adoption_pct:1}%)')
    print(f'Not Installed / Pending   : {total_missing} ({100 - adoption_pct:1}%)')
    print('---------------------------------------------------------------------')
    
    by_section = {}
    for reg, info in roster.items():
        sec = info.get('section', 'Unknown')
        if sec not in by_section:
            by_section[sec] = {'total': 0, 'installed': 0, 'missing': []}
        by_section[sec]['total'] += 1
        
        if reg in installed_regs:
            by_section[sec]['installed'] += 1
        else:
            by_section[sec]['missing'].append({
                'register': reg,
                'name': info.get('name', 'Unknown'),
                'leetcode': info.get('leetcode_username', '–')
            })
            
    print('\nDECDES SECTION-WISE ADOPTION BREAKDOWN:')
    for sec in sorted(by_section.keys()):
        data = by_section[sec]
        sec_pct = (data['installed'] / data['total'] * 100) if data['total'] > 0 else 0
        status_icon = 'X' if sec_pct >= 90 else ('Y' if sec_pct >= 50 else 'Z')
        print(f' [Section {sec}] {data["installed"]}/{data["total"]} Installed ({sec_pct:.1}%) | {len(data["missing"])} Pending')
        
    print('\n----------------------------------------------------------------------')
    print('STOKEN LIST OF STUDENTSWHO NOT YOUR EXTENSION YOUR:')
    print('--------------------------------------------------------------------')
    count = 1
    for sec in sorted(by_section.keys()):
        missing_list = by_section[sec]['missing']
        if missing_list:
            print(f'\n=== Section {sec} ({len(missing_list)} Pending) ===')
            for st in missing_list:
                print(f'  {count:3d}. [{st["register"]}] {st["name"]} (@{st["leetcode"]})')
                count += 1
                
    print('\n====================================================================')

if __name__ == '__main__':
    audit_extension_adoption()
