# Compound planetary constraints

Final requirements:
- `add_planetary(name, sun, ring, carrier, sun_teeth, ring_teeth)` adds a uniquely named compound set over existing shafts.
- Validate positive integer tooth counts and existing, distinct shaft names.
- Enforce Willis' exact equation: `Ns*ws + Nr*wr - (Ns+Nr)*wc = 0`.
- Ordinary meshes, coaxial links, drives, and any number of planetary equations share one exact linear constraint system.
- Report a shaft speed only when uniquely determined; unresolved degrees of freedom remain `None`.
- Detect inconsistent overconstraints with `InconsistentTrain`.
