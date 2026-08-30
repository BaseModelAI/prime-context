class InconsistentTrain(ValueError):
    pass

class GearTrain:
    def add_gear(self, name, teeth):
        raise NotImplementedError
