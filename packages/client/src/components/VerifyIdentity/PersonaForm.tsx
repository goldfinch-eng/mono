import {ErrorMessage} from "@hookform/error-message"
import Persona from "persona"
import {US_COUNTRY_CODE} from "./constants"

export default function PersonaForm({entityType, onEvent, network, address, formMethods}) {
  const PERSONA_CONFIG = {
    mainnet: {templateId: "tmpl_vD1HECndpPFNeYHaaPQWjd6H", environment: "production"},
    localhost: {templateId: "tmpl_vD1HECndpPFNeYHaaPQWjd6H", environment: "sandbox"},
    aurora: {templateId: "tmpl_vD1HECndpPFNeYHaaPQWjd6H", environment: "sandbox"},
  }

  function verifyOnPersona(data, e) {
    e.preventDefault()
    const config = PERSONA_CONFIG[network]
    const client = new Persona.Client({
      templateId: config.templateId,
      environment: config.environment,
      referenceId: address,
      prefill: {
        emailAddress: data.email,
        discord_name: data.discord,
        country_us: entityType === US_COUNTRY_CODE,
      } as any,
      onLoad: (_error) => client.open(),
      onComplete: () => {
        onEvent("complete")
      },
      onFail: (id) => {
        onEvent("fail")
      },
      onExit: (error) => {
        onEvent("exit")
      },
    })
  }

  return (
    <>
      <div>
        <div className="form-input-label">Email</div>
        <div className="form-inputs-footer">
          <div className="form-field">
            <div className="form-input-container">
              <input
                type="email"
                name="email"
                placeholder="email@example.com"
                className="form-input small-text"
                ref={formMethods.register({required: true, pattern: /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/})}
              ></input>
              <div className="form-input-note">
                <ErrorMessage errors={formMethods.errors} name="email" message="That doesn't look like a valid email" />
              </div>
            </div>
          </div>
          <button className={"button submit-form verify"} onClick={formMethods.handleSubmit(verifyOnPersona)}>
            Verify ID
          </button>
        </div>
      </div>
      <div className="form-footer-message">
        Please note: we use{" "}
        <a className="link" target="_blank" rel="noopener noreferrer" href="https://withpersona.com/security/">
          Persona
        </a>{" "}
        to verify your identity, and they handle all personal information. The only information we store is your ETH
        address, country, and approval status. We take privacy seriously.
      </div>
    </>
  )
}
