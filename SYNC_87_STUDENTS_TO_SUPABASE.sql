-- ============================================================
-- UPSERT 86/87 SPECIFIC PROFILES INTO SUPABASE TABLE public.students
-- ============================================================

alter table public.students
  add column if not exists github_username text;

alter table public.students
  drop constraint if exists students_leetcode_username_key,
  drop constraint if exists students_github_username_key;

drop index if exists public.students_leetcode_username_key;
drop index if exists public.students_github_username_key;

insert into public.students (register_number, student_name, leetcode_username, github_username, section)
values
  ('922525106008', 'Ahelesh G S', 'ahelesh_10_', 'ahelesh4-design', 'ECE A'),
  ('922525106010', 'AjaiRajan SR', 'UJw4zUNnJJ', 'srajairajaner20-ops', 'ECE A'),
  ('922525106011', 'ajayKrishna R', '922525106011', 'ajaykrishnavkl2008-png', 'ECE A'),
  ('922525106013', 'Ajith Kumar M', 'ajit_kumar_23', 'nath75119-sudo', 'ECE A'),
  ('922525106016', 'Akshaya S', 'codewithakshaya77', 'akshayasakthivel77', 'ECE A'),
  ('922525106022', 'Anuja S', 'anuja008', 'anujasathies008', 'ECE A'),
  ('922525106027', 'Arulesh K', 'arul2008', 'aruleshk', 'ECE A'),
  ('922525106032', 'ARVINSHANKARA V', null, 'Arvin2597', 'ECE A'),
  ('922525106035', 'BALAJI C', 'Balajichandrasekaran', 'balajicv2007-ai', 'ECE A'),
  ('922525106036', 'BALARITHISH S', 'IOu1mvgrJS', 'rajii444v-lgtm', 'ECE A'),
  ('922525106038', 'Bavitha T', '3gvYU1AYWX', 'bavithathangavel-cell', 'ECE A'),
  ('922525106040', 'BHARANIDHARAN S', 'Bharanidharan_2007', 'Bharanidharan-2007', 'ECE A'),
  ('922525106041', 'Bharath Kumar E', 'BK5226221', 'bk5226221-ctrl', 'ECE A'),
  ('922525106043', 'BHARGAVI K', 'bhargavi_332008', 'BHARGAVIK332008', 'ECE A'),
  ('922525106045', 'Boobase R', 'Boobase', 'rboobase-jpg', 'ECE A'),
  ('922525106046', 'BOOMIKA T', 'boomikat1206', 'boomikathangaraj', 'ECE A'),
  ('922525106047', 'BOSVIYA P', 'BosviyaBSV', 'bosviya710-BSV', 'ECE A'),
  ('922525106048', 'Brindha S', 'BrindhaSakthi', 'brindhasakthi608', 'ECE A'),
  ('922525106051', 'Charunethra S', 'charunethra07', 'charunethra77', 'ECE A'),
  ('922525106052', 'Chinmayasri K', '922525106052', 'chinmaya-sri', 'ECE A'),
  ('922525106054', 'Dakshinya R', 'Dakshinya555', 'Dakshinya784', 'ECE A'),
  ('922525106055', 'Darshan C', null, 'darshan15052008', 'ECE A'),
  ('922525106056', 'Darshan manish A', 'Darshan_manish08', 'darshanmanish25-lab', 'ECE A'),
  ('922525106057', 'Darshan V V', '2007darshan', 'dhevadarshan99-cloud', 'ECE A'),
  ('922525106058', 'Deeksha k', 'Deeksha0721', 'deekshadeeksha410-create', 'ECE A'),
  ('922525106059', 'Dejasri M', 'dejasri', 'dejasri-ece25', 'ECE A'),
  ('922525106060', 'Desma shalini K', 'desmashalini', 'desmashalini2008-txt', 'ECE A'),
  ('922525106061', 'Deva V', 'DevaECE', 'DEVA061', 'ECE A'),
  ('922525106065', 'DHANUSHRI D', '922525106065', 'Dhanushri0805', 'ECE B'),
  ('922525106070', 'DHARANI M', '922525106070', 'dharanim70', 'ECE B'),
  ('922525106072', 'DHARANISH R', '922525601072', 'Dharanish-922525106072', 'ECE B'),
  ('922525106086', 'DIVYA V', '922525106086', 'DivyaVijayakumar1213', 'ECE B'),
  ('922525106092', 'ELAVARASU P', '922525106092', 'elavarasu-coder', 'ECE B'),
  ('922525106093', 'GIRIVASH P', '922525106093', 'Giri-922525106093', 'ECE B'),
  ('922525106101', 'GOWRISANKAR S', '922525106101', 'gowrisankarselvakumar-art', 'ECE B'),
  ('922525106104', 'Gowtham R', '922525106104', null, 'ECE B'),
  ('922525106110', 'HARI HARAN R', null, 'hariharanr1205-cloud', 'ECE B'),
  ('922525106116', 'HARISH MS', null, 'HARISH-0616', 'ECE B'),
  ('922525106380', 'HARJIT VASAN SV', 'Harjit_Vasan', 'HarjitVasan2007', 'ECE E'),
  ('922525106119', 'HAVISHMATHI S', '922525106119', 'havishmathi31-lab', 'ECE B'),
  ('922525106129', 'JASVANTHRAM SP', 'jasvanthram', 'jasvanthrampalanivel-bit', 'ECE C'),
  ('922525106131', 'JAYASURYA R', 'Jayasuryaraja', 'jayasuryaraja08-wq', 'ECE C'),
  ('922525106133', 'JEEVADHARSHAN R R', null, 'jeevadharshan888-ai', 'ECE C'),
  ('922525106137', 'JOTHI HARSHAN D K', 'Jothiharshan16', 'Jothiharshan', 'ECE C'),
  ('922525106141', 'KANISHKUMAR M', 'kanishkumar2008', 'kanishm0204-ui', 'ECE C'),
  ('922525106159', 'KISHOREKUMAR B', 'Kishore9225', 'kishorebala159-maker', 'ECE C'),
  ('922525106161', 'kowshik m', 'kowshikm23', 'kowshikmahalingam23-lang', 'ECE C'),
  ('922525106172', 'logavardhan M', 'loga16', 'logavardhan16-eng', 'ECE C'),
  ('922525106173', 'LOGESH H', 'logesh2008', 'logeshhari2008-maker', 'ECE C'),
  ('922525106381', 'LOHITH T S', 'LOHITH1206', 'Lohith12-ts', 'ECE E'),
  ('922525106184', 'M. MAHALAKSHMI', 'K9gejZlwRP', 'mahalakshmi0608com-alt', 'ECE C'),
  ('922525106178', 'MADHAN VELU G', 'madhan_1234', 'velumadhan471-del', 'ECE C'),
  ('922525106188', 'Malini S', 'MaliniSenthil', 'senthilmalini732-web', 'ECE C'),
  ('922525106191', 'Manoj Kumar V', 'm____a____n____o____', 'Mano-ECE', 'ECE D'),
  ('922525106192', 'Mathansurya S', 'Mathansurya', 'mathan-24', 'ECE D'),
  ('922525106197', 'Mithan P', 'Mithan_6', 'mithan0', 'ECE D'),
  ('922525106212', 'Nethra.S', 'Nethra777', 'n09123678-collab', 'ECE D'),
  ('922525106221', 'NIVETHA T', 'NIVETHA_THANGARAJ07', 'Nivethathangaraj08', 'ECE D'),
  ('922525106229', 'Pranesh Y', 'Pranesh_Y', 'Pranesh08-Tech', 'ECE D'),
  ('922525106238', 'Priyanka A', 'Priyankaashok1201', 'Priyanka12010708', 'ECE D'),
  ('922525106245', 'Ranjith K', 'ranjithkannan', 'ranjithkannan210', 'ECE D'),
  ('922525106251', 'Rethanya S', 'SekarRethanya', null, 'ECE D'),
  ('922525106255', 'Rithik I', 'Rithik2008', 'iyappanrithik2008-del', 'ECE E'),
  ('922525106256', 'Rithik p', 'Rithik_78', 'rithikprakash78-design', 'ECE E'),
  ('922525106258', 'Rithish R', 'Rithish_', 'rithishrithish05715', 'ECE E'),
  ('922525106266', 'sahana.v', 'Sahanavijayakumar_0033', 'sahanavijaysahana724-ship-it', 'ECE E'),
  ('922525106269', 'sakthivel. M', 'sakthivel23116', 'muruganmurugan23116-a11y', 'ECE E'),
  ('922525106275', 'Sanjay U', 'SanjayUdayan', 'sanjayudayan', 'ECE E'),
  ('922525106276', 'Sanjayan S', 'sanjayan31', 'Sanjayan-123', 'ECE E'),
  ('922525106277', 'Sanjevi P', 'sanjevi007', 'sanjevisanju5-coder', 'ECE E'),
  ('922525106283', 'santhosh s', 'santhoshsathya260', 'ecesanthosh80-creator', 'ECE E'),
  ('922525106291', 'Sarveswaran R', 'sarvesh312008', 'sarveswaran3152008-ship-it', 'ECE E'),
  ('922525106292', 'SASHMIKA P', 'sashmikaprabhu', 'sashmikaprabhu-cpu', 'ECE E'),
  ('922525106293', 'saswin D', 'saswin_88', 'saswind7', 'ECE E'),
  ('922525106294', 'Sathana Sri S K', 'Sathana-1267', 'sathanasri470-prog', 'ECE E'),
  ('922525106304', 'SHANTHOSH SHAI SIRIL R', 'shandoshsai', 'santhoshshaisiril', 'ECE E'),
  ('922525106309', 'SHREE CHARAN T', 'shreecharan22', 'Shreecharan22', 'ECE E'),
  ('922525106312', 'Sivadharshini D', 'dharshinideivasigamani', 'dharshinideivasigamani15-droid', 'ECE E'),
  ('922525106314', 'sivanesh D', 'sivanesh2007', 'sivanesh292007', 'ECE E'),
  ('922525106341', 'SURYA PRABHU S', 'SURYA_FOUNDER', 'SURYATHEFOUNDER', 'ECE F'),
  ('922525106346', 'swetha E', 'Swetha_20_1', 'shwemarble2008-alt', 'ECE F'),
  ('922525106353', 'Thirisha C', 'thirishavsb', 'thirisha182007-eng', 'ECE F'),
  ('922525106356', 'vasanthkumar C', 'VASANTH2007', 'vasanthkumar-coder777', 'ECE F'),
  ('922525106365', 'VIGNESHWAR U', 'VIGNESHWAR0221', 'VIGNESHWAR0221', 'ECE F'),
  ('922525106366', 'VIJAYARAGAVAN R', 'vijayaragavan1216', 'vijayragavan1216-coder', 'ECE F'),
  ('922525106377', 'YAZHINI V', 'YAZH_RUBA', 'yazhu0619', 'ECE F')
on conflict (register_number) do update set
  student_name = excluded.student_name,
  leetcode_username = coalesce(excluded.leetcode_username, public.students.leetcode_username),
  github_username = coalesce(excluded.github_username, public.students.github_username),
  section = excluded.section;

select count(*) as updated_count from public.students where register_number in (
  '922525106008', '922525106010', '922525106011', '922525106013', '922525106016', '922525106022', '922525106027', '922525106032', '922525106035', '922525106036', '922525106038', '922525106040', '922525106041', '922525106043', '922525106045', '922525106046', '922525106047', '922525106048', '922525106051', '922525106052', '922525106054', '922525106055', '922525106056', '922525106057', '922525106058', '922525106059', '922525106060', '922525106061', '922525106065', '922525106070', '922525106072', '922525106086', '922525106092', '922525106093', '922525106101', '922525106104', '922525106110', '922525106116', '922525106380', '922525106119', '922525106129', '922525106131', '922525106133', '922525106137', '922525106141', '922525106159', '922525106161', '922525106172', '922525106173', '922525106381', '922525106184', '922525106178', '922525106188', '922525106191', '922525106192', '922525106197', '922525106212', '922525106221', '922525106229', '922525106238', '922525106245', '922525106251', '922525106255', '922525106256', '922525106258', '922525106266', '922525106269', '922525106275', '922525106276', '922525106277', '922525106283', '922525106291', '922525106292', '922525106293', '922525106294', '922525106304', '922525106309', '922525106312', '922525106314', '922525106341', '922525106346', '922525106353', '922525106356', '922525106365', '922525106366', '922525106377'
);