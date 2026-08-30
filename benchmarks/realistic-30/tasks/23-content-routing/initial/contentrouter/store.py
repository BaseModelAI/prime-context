from __future__ import annotations

class ContentRouter:
    @classmethod
    def from_dict(cls, config):
        raise NotImplementedError

    def resolve(self, path, *, values=None):
        raise NotImplementedError
