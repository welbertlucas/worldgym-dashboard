import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { CampoM2 } from "@/components/tabs/EstudosPontoTab";

describe("campo de m² do estudo de ponto", () => {
  it("é um campo de texto numérico (sem a correção a cada tecla do campo de número) e mostra o valor atual", () => {
    const html = renderToString(<CampoM2 valor={7250} aoMudar={() => {}} />);
    expect(html).toContain('value="7250"');
    expect(html).toContain('inputMode="numeric"');
    expect(html).not.toContain('type="number"');
  });
});
