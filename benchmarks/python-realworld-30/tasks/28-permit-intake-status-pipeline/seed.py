#!/usr/bin/env python3.12
from __future__ import annotations
import argparse,csv,json,random,shutil
from pathlib import Path
from xml.etree.ElementTree import Element,SubElement,ElementTree
SEED=20260831+28
FIELDS=["source_id","revision","parcel_id","owner_id","permit_type","submitted_date","closed_date","fee_paid"]
def write_csv(path,header,rows):
 path.parent.mkdir(parents=True,exist_ok=True)
 with path.open("w",encoding="utf-8",newline="") as f:csv.writer(f,lineterminator="\n").writerows([header,*rows])
def record(i,**changes):
 row={"source_id":f"APP-{i:04d}","revision":1,"parcel_id":f"PAR-{i:04d}","owner_id":f"OWN-{i:04d}","permit_type":"sign","submitted_date":"2025-05-10","closed_date":"","fee_paid":"50.00"};row.update(changes);return row
def write_apps(inputs,base,duplicates):
 raw=[*base,*duplicates];assert len(raw)==1000 or len(raw)==1
 cut=500 if len(raw)>1 else 1
 (inputs/"applications.json").write_text(json.dumps({"applications":raw[:cut]},indent=2)+"\n",encoding="utf-8")
 root=Element("applications")
 for row in raw[cut:]:
  node=SubElement(root,"application")
  for key in FIELDS:SubElement(node,key).text=str(row.get(key,""))
 ElementTree(root).write(inputs/"applications.xml",encoding="unicode",xml_declaration=True)
def seed(root,fixture):
 if root.exists():shutil.rmtree(root)
 inputs=root/"inputs";inputs.mkdir(parents=True);(root/"workspace").mkdir();(root/"output").mkdir()
 if fixture=="edge":
  base=[record(1,source_id="APP-EDGE",parcel_id="PX-ABSENT",owner_id="OWN-0001")]
  write_apps(inputs,base,[])
  owners=[["OWN-0001","Edge Owner"]];parcels=[];attachments=[["DOC-E","APP-EDGE","SITE","","edge.pdf"]]
 else:
  rng=random.Random(SEED)
  anchors=[
   record(1,permit_type="residential",fee_paid="100.00"),
   record(2,owner_id="OWN-0999"),
   record(3,permit_type="residential",fee_paid="100.00"),
   record(4,permit_type="commercial",fee_paid="250.00"),
   record(5),record(6,permit_type="commercial",owner_id="OWN-0006",fee_paid="250.00"),
   record(7,permit_type="residential",closed_date="2025-05-15",fee_paid="100.00"),
   record(8,permit_type="residential",fee_paid="100.00"),
   record(9,permit_type="residential",fee_paid="100.00"),
   record(10,permit_type="residential",fee_paid="100.00"),
  ]
  base=anchors[:]
  for i in range(11,996):
   typ="residential" if i%7==0 else "commercial" if i%5==0 else "sign"
   fee={"residential":"100.00","commercial":"250.00","sign":"50.00"}[typ]
   closed="2025-05-20" if typ=="residential" and i%17==0 else ""
   base.append(record(i,permit_type=typ,fee_paid=fee,closed_date=closed,submitted_date=f"2025-05-{1+rng.randrange(28):02d}"))
  duplicates=[]
  for i in range(11,16):
   row=dict(base[i-1]);row["revision"]=2;duplicates.append(row)
  # APP-0006's higher revision is the important mixed-source anchor.
  duplicates[0]=dict(base[5]);duplicates[0]["revision"]=3;duplicates[0]["owner_id"]="OWN-0007"
  write_apps(inputs,base,duplicates)
  owners=[[f"OWN-{i:04d}",f"Owner {i:04d}"] for i in range(1,1001)]
  parcels=[[f"PAR-{i:04d}",f"OWN-{i:04d}",("R","C","I")[i%3]] for i in range(1,1001)]
  parcels[0][2]="R";parcels[1][2]="R";parcels[2][2]="R";parcels[3][2]="C";parcels[4][2]="I";parcels[5][2]="C";parcels[6][2]="R";parcels[7][2]="R";parcels[8][2]="R";parcels[9][2]="R"
  attachments=[];doc=1
  for row in base:
   i=int(row["source_id"].split("-")[1]);typ=row["permit_type"]
   if i==3:continue
   dtype={"residential":"PLAN","commercial":"STRUCT","sign":"SITE"}[typ]
   exp="2025-06-01" if i==11 else ""
   attachments.append([f"DOC-{doc:05d}",row["source_id"],dtype,exp,f"{dtype.lower()}-{i}.pdf"]);doc+=1
  attachments.append([f"DOC-{doc:05d}","APP-0001","ENERGY","","energy-1.pdf"]);doc+=1
  attachments.append([f"DOC-{doc:05d}","APP-0010","ENERGY","","energy-10.pdf"])
 write_csv(inputs/"owners.csv",["owner_id","name"],owners)
 write_csv(inputs/"parcels.csv",["parcel_id","owner_id","zone"],parcels)
 write_csv(inputs/"zoning_rules.csv",["zone","permit_type"],[["R","residential"],["R","sign"],["C","commercial"],["C","sign"]])
 write_csv(inputs/"document_requirements.csv",["permit_type","document_type"],[["residential","PLAN"],["commercial","STRUCT"],["sign","SITE"]])
 write_csv(inputs/"fee_table.csv",["permit_type","required_fee"],[["residential","100.00"],["commercial","250.00"],["sign","50.00"]])
 write_csv(inputs/"attachments.csv",["document_id","source_id","document_type","expires_on","filename"],attachments)
 (inputs/"settings.json").write_text(json.dumps({"validation_date":"2025-06-15"},indent=2)+"\n",encoding="utf-8")
def main():
 p=argparse.ArgumentParser();p.add_argument("--workspace",type=Path,required=True);p.add_argument("--fixture",choices=("main","edge"),required=True);a=p.parse_args();seed(a.workspace,a.fixture)
if __name__=="__main__":main()
