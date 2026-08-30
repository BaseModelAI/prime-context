class CycleError(ValueError):
    pass

class Workbook:
    def set(self, cell, value_or_formula):
        raise NotImplementedError
    def get(self, cell):
        raise NotImplementedError
