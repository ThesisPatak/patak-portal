#!/usr/bin/env python3
import os
import sys

base_path = r'c:\Users\Jojo\OneDrive\Desktop\PATAK-PORTAL'
os.chdir(base_path)

# Files to delete
temp_files = ['cleanup.py', 'cleanup2.bat', 'fix_gcash.py', 'remove_gcash.py', 'replace_admin.ps1']

# Step 1: Delete AdminDashboard.tsx if exists
if os.path.exists('AdminDashboard.tsx'):
    os.remove('AdminDashboard.tsx')
    print('[OK] Deleted AdminDashboard.tsx')
else:
    print('[OK] AdminDashboard.tsx does not exist (skipped)')

# Step 2: Rename AdminDashboard_fixed.tsx to AdminDashboard.tsx
if os.path.exists('AdminDashboard_fixed.tsx'):
    os.rename('AdminDashboard_fixed.tsx', 'AdminDashboard.tsx')
    print('[OK] Renamed AdminDashboard_fixed.tsx to AdminDashboard.tsx')
else:
    print('[ERROR] AdminDashboard_fixed.tsx not found!')
    sys.exit(1)

# Step 3: Delete temporary files
for file in temp_files:
    if os.path.exists(file):
        os.remove(file)
        print(f'[OK] Deleted {file}')
    else:
        print(f'[OK] {file} does not exist (skipped)')

# Step 4: Verify only one AdminDashboard.tsx exists
admin_files = [f for f in os.listdir('.') if 'AdminDashboard' in f and f.endswith('.tsx')]
print(f'\n[Verification] AdminDashboard files found: {admin_files}')
if len(admin_files) == 1 and admin_files[0] == 'AdminDashboard.tsx':
    print('[SUCCESS] Only AdminDashboard.tsx exists - consolidation complete!')
    sys.exit(0)
else:
    print('[ERROR] Unexpected AdminDashboard files state')
    sys.exit(1)
