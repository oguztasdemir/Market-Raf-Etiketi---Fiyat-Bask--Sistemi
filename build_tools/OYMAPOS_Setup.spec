# -*- mode: python ; coding: utf-8 -*-
import os

SPECDIR = os.path.dirname(os.path.abspath(SPEC))
ROOT_DIR = os.path.abspath(os.path.join(SPECDIR, '..'))

a = Analysis(
    [os.path.join(SPECDIR, 'oymapos_installer.py')],
    pathex=[ROOT_DIR],
    binaries=[],
    datas=[
        (os.path.join(ROOT_DIR, 'dist', 'OYMAPOS.exe'), '.'),
        (os.path.join(ROOT_DIR, 'frontend', 'resimler', 'logo.png'), 'frontend/resimler'),
        (os.path.join(SPECDIR, 'logo.ico'), '.'),
        (os.path.join(SPECDIR, 'redist', 'api-ms-win-core-path-l1-1-0.dll'), '.'),
        (os.path.join(SPECDIR, 'redist', 'vc_redist.x64.exe'), 'redist'),
        (os.path.join(SPECDIR, 'redist', 'MicrosoftEdgeWebview2Setup.exe'), 'redist')
    ],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
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
    name='OYMAPOS_Setup',
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

