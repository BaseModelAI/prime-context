import re

def choose(description, amount, rules):
    # BUG: later matches overwrite earlier ordered rules.
    selected=None
    for rule in rules:
        if re.search(rule["pattern"], description, re.I): selected=rule
    return selected
