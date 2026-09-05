# -*- coding: utf-8 -*-
import sys
import os

if sys.platform.startswith('win'):
    try:
        import ctypes
        base_dir = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
        if os.path.isdir(base_dir):
            if base_dir not in sys.path:
                sys.path.insert(0, base_dir)
            cur_p = os.environ.get('PATH', '')
            if base_dir not in cur_p:
                os.environ['PATH'] = base_dir + ';' + cur_p
            try:
                ctypes.windll.kernel32.SetDllDirectoryW(base_dir)
            except Exception:
                pass
    except Exception:
        pass
