# The repair must replace float arithmetic with Decimal.
def parse(value):
    return float(value)

def format_money(value):
    return str(round(value, 2))
