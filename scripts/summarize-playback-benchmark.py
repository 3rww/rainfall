#!/usr/bin/env python3
"""Summarize measured playback runs without retaining large profiles in the repository.
Usage: script OUTPUT.json label=REPORT_DIRECTORY [label=REPORT_DIRECTORY ...]
"""
import json
import sys
from pathlib import Path
from statistics import median

def distribution(values):
    if not values:
        return None
    ordered = sorted(values)
    return {'median': median(ordered), 'p95': ordered[min(len(ordered)-1, int(len(ordered)*0.95))], 'max': max(ordered)}

report = {'date': '2026-11-03', 'workload': {'radar': 2313, 'gauges': 33, 'timesteps': 101, 'warmups': 1, 'measuredRuns': 5}, 'variants': {}}
for argument in sys.argv[2:]:
    label, folder = argument.split('=', 1)
    root = Path(folder)
    cpu_file = root / 'firefox-cpu.json'
    cpu = json.loads(cpu_file.read_text())['runs'] if cpu_file.exists() else []
    cases = []
    for file in sorted(root.glob('*.json')):
        if file.name == 'firefox-cpu.json':
            continue
        data = json.loads(file.read_text())
        if 'browserName' not in data:
            continue
        runs = []
        for number, run in enumerate(data['runs'], 1):
            cpu_row = next((r for r in cpu if r['mode'] == data['mode'] and r['run'] == number), None) if data['browserName'] == 'firefox' else None
            runs.append({
                'run': number, 'mainThreadCpuMs': cpu_row['cpuMs'] if cpu_row else None,
                'displayedTimesteps': 1 + len(run['frames']), 'finalFrameMs': run['frames'][-1]['at'], 'seekMs': run['seekMs'],
                'rafGapMs': distribution(run['gaps']), 'activeBurstGapMs': distribution(run.get('burstGaps', [])),
                'longTasks': {'count': len(run['longTasks']), 'totalMs': sum(t['duration'] for t in run['longTasks'])} if run.get('longTasksSupported') else None,
                'diagnostics': run['diagnostics']
            })
        medians = {key: median(r[key] for r in runs) for key in ['displayedTimesteps', 'finalFrameMs', 'seekMs']}
        medians['mainThreadCpuMs'] = median(r['mainThreadCpuMs'] for r in runs) if runs[0]['mainThreadCpuMs'] is not None else None
        cases.append({'browser': data['browserName'], 'mode': data['mode'], 'requestedBackend': data['backend'],
                      'environment': data['environment'], 'viewport': data['viewport'], 'revision': data['revision'], 'medians': medians, 'runs': runs})
    report['variants'][label] = cases
if 'original' in report['variants'] and 'custom' in report['variants']:
    checks = []
    for browser in ('chromium', 'firefox'):
        for mode in ('interval', 'cumulative', 'combined'):
            original = next((c for c in report['variants']['original'] if c['browser'] == browser and c['mode'] == mode), None)
            custom = next((c for c in report['variants']['custom'] if c['browser'] == browser and c['mode'] == mode), None)
            check = {'browser': browser, 'mode': mode, 'complete': bool(original and custom)}
            if original and custom:
                before, after = original['medians'], custom['medians']
                check.update({
                    'fiveMeasuredRuns': len(original['runs']) == len(custom['runs']) == 5,
                    'noFallback': all(r['diagnostics']['backend'] == 'custom' for r in custom['runs']),
                    'noFewerTimesteps': after['displayedTimesteps'] >= before['displayedTimesteps'],
                    'seekNotSlower': after['seekMs'] <= before['seekMs'],
                    'allFinalFramesWithin10500ms': all(r['finalFrameMs'] <= 10500 for r in custom['runs'])
                })
                if browser == 'firefox':
                    check['cpuReductionAtLeast50Percent'] = bool(before['mainThreadCpuMs'] and after['mainThreadCpuMs'] is not None and after['mainThreadCpuMs'] <= before['mainThreadCpuMs'] / 2)
            check['passed'] = all(value for key, value in check.items() if key not in ('browser', 'mode'))
            checks.append(check)
    report['acceptance'] = {'passed': all(c['passed'] for c in checks), 'checks': checks}
Path(sys.argv[1]).write_text(json.dumps(report, indent=2) + '\n')
for label, cases in report['variants'].items():
    for case in cases:
        m = case['medians']
        print(label, case['browser'], case['mode'], {key: round(value, 1) if value is not None else None for key, value in m.items()})
if 'acceptance' in report:
    print('Full-grid acceptance:', 'PASS' if report['acceptance']['passed'] else 'FAIL / incomplete')
    if not report['acceptance']['passed']:
        raise SystemExit(1)
