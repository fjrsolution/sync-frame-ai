if (__import__('sys').implementation.name != 'cpython' or __import__('importlib.util', fromlist=['MAGIC_NUMBER']).MAGIC_NUMBER != b'\xa7\r\r\n'):
    raise RuntimeError('Paket ini memerlukan CPython 3.11. Gunakan launcher MULAI yang disertakan.')
exec(__import__('marshal').loads(__import__('zlib').decompress(__import__('base64').b85decode('c-ni+fCLz!^k+68F`XfWA(%mv(QhR~5fexdB=bu+DKR-aH7`X!K0Y%qvm`!Vub}c5hfQvNN@-52T@fqPlwy7$@qw9<k?{iqj3{CTiU9zd&K67'))), globals())
