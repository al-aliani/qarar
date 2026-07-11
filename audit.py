import json

try:
    with open('G:\\دراسة الجدوى\\web\\public\\data\\database-files.json', encoding='utf-8') as f:
        db_data = json.load(f)
    print('=== DATABASE FILES ===')
    for g in db_data['groups']:
        print(f'\nGroup: {g["label"]}')
        for f in g['files']:
            print(f'  - {f["filename"]}')
except Exception as e:
    print('Error loading database-files.json', e)

try:
    with open('G:\\دراسة الجدوى\\web\\public\\data\\hr-files.json', encoding='utf-8') as f:
        hr_data = json.load(f)
    print('\n=== HR FILES ===')
    for g in hr_data['groups']:
        print(f'\nGroup: {g["label"]}')
        for f in g['files']:
            print(f'  - {f["filename"]}')
except Exception as e:
    print('Error loading hr-files.json', e)
