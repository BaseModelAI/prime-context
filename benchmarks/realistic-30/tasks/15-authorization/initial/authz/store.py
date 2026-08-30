class PolicyEngine:
    def authorize(self, subject, resource, action, **options):
        raise NotImplementedError
