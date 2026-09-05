# -*- mode: python ; coding: utf-8 -*-
import os

SPECDIR = os.path.dirname(os.path.abspath(SPEC))
ROOT_DIR = os.path.abspath(os.path.join(SPECDIR, '..'))


a = Analysis(
    [os.path.join(ROOT_DIR, 'desktop_app.py')],
    pathex=[ROOT_DIR],
    binaries=[
        (os.path.join(SPECDIR, 'redist', f), '.') for f in os.listdir(os.path.join(SPECDIR, 'redist')) if f.lower().endswith('.dll')
    ] if os.path.exists(os.path.join(SPECDIR, 'redist')) else [],
    datas=[
        (os.path.join(ROOT_DIR, 'frontend'), 'frontend'),
        (os.path.join(ROOT_DIR, 'backend', 'katalog', 'seed_urunler.json'), 'backend/katalog'),
        (os.path.join(ROOT_DIR, 'backend', 'katalog', 'seed_manav_urunleri.json'), 'backend/katalog'),
        (os.path.join(ROOT_DIR, 'backend', 'terazi', 'motor'), 'backend/terazi/motor')
    ],
    hiddenimports=[
        'flask',
        'werkzeug',
        'werkzeug.serving',
        'werkzeug.routing',
        'jinja2',
        'itsdangerous',
        'click',
        'blinker',
        'selectors',
        'socket',
        'select',
        'urllib3',
        'requests',
        'PIL',
        'barcode',
        'qrcode',
        'serial',
        'reportlab',
        'webview',
        'clr',
        'pythonnet'
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[
        os.path.join(SPECDIR, 'rthook_win7_dll.py')
    ],
    excludes=['multiprocessing', 'PyQt6', 'PySide6', 'PySide2', 'sqlalchemy', 'torch', 'tensorflow', 'matplotlib', 'scipy', 'ipython', 'tkinter'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='OYMAPOS',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=[os.path.join(SPECDIR, 'logo.ico')],
)

