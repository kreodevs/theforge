import { describe, expect, it } from "vitest";
import {
  buildComponentPreviewPropsLiteral,
  collectRequirementsContext,
  parseDsPropsCell,
} from "./wireframeScreenPreview";

describe("wireframeScreenPreview", () => {
  it("collects HU sections by reference id", () => {
    const hu = `
### Historia de usuario: HU-001 Login

### 🧾 Historia de Usuario

**Como:** usuario registrado
**Quiero:** iniciar sesión con mi correo y contraseña
**Para:** acceder al panel

### ✅ Criterios de Aceptación

- El sistema valida credenciales
`;
    const ctx = collectRequirementsContext("", hu, ["HU-001"]);
    expect(ctx).toContain("iniciar sesión");
    expect(ctx).toContain("usuario registrado");
  });

  it("merges DS props with HU labels for buttons", () => {
    const hu = `
**Como:** admin
**Quiero:** guardar los cambios del formulario
**Para:** persistir datos
`;
    const literal = buildComponentPreviewPropsLiteral(
      "Button",
      'variant="primary"',
      hu,
    );
    expect(literal).toContain("guardar");
    expect(literal).toContain("variant");
  });

  it("parses attribute-style DS props", () => {
    expect(parseDsPropsCell('type="email", placeholder="Correo"')).toEqual({
      type: "email",
      placeholder: "Correo",
    });
  });
});
