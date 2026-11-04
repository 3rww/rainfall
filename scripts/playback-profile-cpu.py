#!/usr/bin/env python3
"""Extract main-thread CPU from raw Firefox startup profiles and benchmark markers.
Usage: python3 scripts/playback-profile-cpu.py PROFILE.json REPORT_DIRECTORY
Only measured runs 1..5 count; run 0 is warmup. No stack-time approximation.
"""
import json
import sys
from pathlib import Path
from statistics import median
profile = json.loads(Path(sys.argv[1]).read_text())
if profile['meta'].get('sampleUnits', {}).get('threadCPUDelta') != 'ns':
    raise SystemExit('Expected nanosecond CPU samples; this profile needs a unit conversion.')
records = []
def visit(process):
    for thread in process.get('threads', []):
        if thread['name'] != 'GeckoMain' or thread.get('processName') != 'Web Content':
            continue
        schema = thread['markers']['schema']
        marks = {}
        for row in thread['markers']['data']:
            payload = row[schema['data']] if len(row) > schema['data'] else None
            if isinstance(payload, dict) and payload.get('type') == 'UserTiming':
                name = payload.get('name', '')
                if name.startswith('rainfall:'):
                    marks[name] = row[schema['startTime']]
        sample_schema = thread['samples']['schema']
        if 'threadCPUDelta' not in sample_schema:
            raise SystemExit('Profile has no thread CPU samples; enable the cpu profiler feature.')
        for name, start in marks.items():
            if not name.endswith(':start'):
                continue
            _, mode, run, _ = name.split(':')
            if run == '0':
                continue
            end = marks.get(name[:-5] + 'end')
            if end is None:
                raise SystemExit(f'Missing end marker: {name}')
            # Fixed ten-second window, independent of test-driver polling or delayed completion.
            cpu_ns = sum((row[sample_schema['threadCPUDelta']] or 0) if len(row) > sample_schema['threadCPUDelta'] else 0 for row in thread['samples']['data']
                         if start <= row[sample_schema['time']] < start + 10000)
            records.append({'mode': mode, 'run': int(run), 'cpuMs': cpu_ns / 1e6, 'elapsedMs': end-start})
    for child in process.get('processes', []):
        visit(child)
visit(profile)
for mode in ('interval', 'cumulative', 'combined'):
    values = [row['cpuMs'] for row in records if row['mode'] == mode]
    if len(values) != 5:
        raise SystemExit(f'{mode}: expected 5 measured windows, found {len(values)}')
    print(f'{mode}: median main-thread CPU {median(values):.1f} ms; runs {[round(v,1) for v in values]}')
Path(sys.argv[2], 'firefox-cpu.json').write_text(json.dumps({'source': Path(sys.argv[1]).name, 'sampleUnits': profile['meta']['sampleUnits'], 'runs': records}, indent=2))
