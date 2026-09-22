-- Los convenios no alcanzan a las bicicletas, salvo que el administrador lo
-- decida convenio por convenio.
--
-- El valor por defecto es FALSO, y es la decisión correcta: un convenio se
-- declaró pensando en los carros del centro comercial de al lado, y aplicarlo
-- también a las bicicletas sin que nadie lo pidiera regalaría dinero en
-- silencio. Que el administrador tenga que encenderlo es justamente lo que
-- convierte eso en una decisión.
--
-- Es por convenio y no por establecimiento porque los acuerdos son distintos
-- entre sí: el del supermercado puede cubrir bicicletas y el del edificio de
-- oficinas no.

ALTER TABLE "convenio"
  ADD COLUMN "aplica_bicicletas" boolean DEFAULT false NOT NULL;
