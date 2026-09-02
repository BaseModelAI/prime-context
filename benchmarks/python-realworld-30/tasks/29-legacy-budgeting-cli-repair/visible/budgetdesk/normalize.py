import re, unicodedata

def description(value):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value).strip())
