import argparse
from . import server
def main(argv=None):
 p=argparse.ArgumentParser(prog="helpdesk");s=p.add_subparsers(dest="cmd",required=True)
 q=s.add_parser("serve");q.add_argument("--db",required=True);q.add_argument("--port",type=int,required=True)
 a=p.parse_args(argv)
 if a.cmd=="serve":server.serve(a.db,a.port)
