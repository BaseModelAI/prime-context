#!/usr/bin/env python3.12
import argparse,mailbox
from email.message import EmailMessage
from pathlib import Path

def msg(mid,to,subject,body,date,reply=None):
 m=EmailMessage();m["From"]="customer@example.test";m["To"]=to;m["Subject"]=subject;m["Date"]=date;m["Message-ID"]=mid
 if reply:m["In-Reply-To"]=reply;m["References"]=reply
 m.set_content(body);return m

def write(path,messages):
 path.parent.mkdir(parents=True,exist_ok=True);box=mailbox.mbox(path,create=True)
 try:
  for m in messages:box.add(m)
  box.flush()
 finally:box.close()

def main():
 p=argparse.ArgumentParser();p.add_argument("--output",type=Path,required=True);p.add_argument("--fixture",choices=("main","edge"),required=True);a=p.parse_args()
 if a.fixture=="edge":
  m=msg("<duplicate-edge@example.test>","support+1@example.test","Edge duplicate","One imported comment","Fri, 23 May 2025 10:00:00 +0000")
  write(a.output/"inputs/archive-a.mbox",[m]);write(a.output/"inputs/archive-b.mbox",[m]);return
 rows=[
  msg("<mail-1@example.test>","support+1@example.test","Re: Printer paper jam","Still grinding after restart","Fri, 23 May 2025 10:00:00 +0000"),
  msg("<mail-2@example.test>","support+2@example.test","Re: Payroll sign in","The login loop remains","Fri, 23 May 2025 11:00:00 +0000"),
  msg("<mail-3@example.test>","support@example.test","VPN Café access","Need secure VPN café access for travel","Fri, 23 May 2025 12:00:00 +0000"),
  msg("<mail-4@example.test>","support@example.test","Re: VPN Café access","The VPN token still fails","Fri, 23 May 2025 12:30:00 +0000","<mail-3@example.test>"),
  msg("<mail-1@example.test>","support+1@example.test","duplicate","must be skipped","Fri, 23 May 2025 10:01:00 +0000"),
 ]
 for i in range(5,5000):
  rows.append(msg(f"<bulk-{i:04d}@example.test>","support+1@example.test",f"Printer follow-up {i:04d}",f"Diagnostic observation {i:04d}","Fri, 23 May 2025 13:00:00 +0000"))
 assert len(rows)==5000;write(a.output/"inputs/archive.mbox",rows)
if __name__=="__main__":main()
