#!/usr/bin/env python3
"""Generate the 1.2-million-row Task 19 payload outside the workspace."""
from __future__ import annotations
import argparse,csv,gzip,io,json,random
from datetime import datetime,timedelta,timezone
from pathlib import Path
SEED=20260831+19
SENSORS={**{f"G{i:02d}":"gauge" for i in range(1,16)},**{f"C{i:02d}":"counter" for i in range(1,16)}}
BASE=datetime(2025,1,1,tzinfo=timezone.utc)
def stamp(value): return value.strftime("%Y-%m-%dT%H:%M:%SZ")
def gzip_writer(path):
    raw=path.open("wb"); zipped=gzip.GzipFile(filename="",mode="wb",fileobj=raw,compresslevel=1,mtime=0); return raw,zipped,io.TextIOWrapper(zipped,encoding="utf-8",newline="")
def generate(output,fixture):
    inputs=output/"inputs"; inputs.mkdir(parents=True,exist_ok=True)
    (inputs/"sensors.json").write_text(json.dumps(SENSORS,indent=2,sort_keys=True)+"\n",encoding="utf-8")
    raw,zipped,text=gzip_writer(inputs/"readings.csv.gz")
    try:
        writer=csv.writer(text,lineterminator="\n");writer.writerow(["timestamp","sensor_id","value","status"])
        if fixture=="edge":
            writer.writerows([
                ["2025-01-01T00:00:00Z","G01","5","GOOD"],
                ["2025-01-01T00:05:00Z","G01","999","BAD"],
                ["2025-01-01T00:06:00Z","G01","888","BAD"],
                ["2025-01-01T00:22:00Z","G01","7","GOOD"],
            ])
        else:
            rng=random.Random(SEED); ids=sorted(SENSORS)
            for tick in range(40000):
                regular=BASE+timedelta(seconds=tick*300)
                regular_stamp=stamp(regular)
                for position,sensor in enumerate(ids,1):
                    current_stamp=regular_stamp;status="BAD" if (tick*31+position*17)%9973==0 else "GOOD"
                    if sensor=="G01" and tick<5:
                        current_stamp=("2025-01-01T00:00:00Z","2025-01-01T00:02:00Z","2025-01-01T00:04:00Z","2025-01-01T00:05:00Z","2025-01-01T00:25:00Z")[tick]
                        value=("10","14","999","20","30")[tick];status="BAD" if tick==2 else "GOOD"
                    elif sensor=="G01" and tick>=5:
                        current_stamp=stamp(BASE+timedelta(seconds=(tick+2)*300));value=str(rng.randrange(10**37,10**38))
                    elif sensor=="G02" and tick<3:
                        value=("1","999","3")[tick]; status="BAD" if tick==1 else "GOOD"
                    elif sensor=="C01" and tick<7:
                        current_stamp=("2025-01-01T00:00:00Z","2025-01-01T00:04:00Z","2025-01-01T00:05:00Z","2025-01-01T00:09:00Z","2025-01-01T00:10:00Z","2025-01-01T00:14:00Z","2025-01-01T00:31:00Z")[tick]
                        value=("100","110","130","999","90","95","105")[tick];status="BAD" if tick==3 else "GOOD"
                    elif SENSORS[sensor]=="gauge": value=str(rng.randrange(10**37,10**38))
                    else:
                        index=int(sensor[1:]);value=str(index*10**45+tick*10**40+rng.randrange(10**39))
                    writer.writerow([current_stamp,sensor,value,status])
    finally:
        text.flush();text.detach();zipped.close();raw.close()
if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--output",required=True,type=Path);p.add_argument("--fixture",required=True,choices=("main","edge"));a=p.parse_args();generate(a.output.resolve(),a.fixture)
