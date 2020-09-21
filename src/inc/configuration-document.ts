import defu from 'defu'
import type { Scheme, OpenIDConnectConfigurationDocument } from '../index'
import Storage from '../core/storage'

class ConfigurationDocumentRequestError extends Error {
  constructor () {
    super('Error loading OpenIDConnect configuration document')
    this.name = 'ConfigurationDocumentRequestError'
  }
}

export default class ConfigurationDocument {
  public scheme: Scheme
  public $storage: Storage
  public key: string

  constructor (scheme: Scheme, storage: Storage) {
    this.scheme = scheme
    this.$storage = storage
    this.key = '_configuration_document.' + this.scheme.name
  }

  _set (value: OpenIDConnectConfigurationDocument | boolean) {
    return this.$storage.setState(this.key, value)
  }

  get (): OpenIDConnectConfigurationDocument {
    return this.$storage.getState(this.key)
  }

  set (value: OpenIDConnectConfigurationDocument | boolean) {
    this._set(value)

    return value
  }

  async request () {
    // Get Configuration document from state hydration
    const serverDoc: OpenIDConnectConfigurationDocument = this.scheme.$auth.ctx?.nuxtState?.$auth?.oidc?.configurationDocument
    if (process.client && serverDoc) {
      this.set(serverDoc)
    }

    if (!this.get()) {
      const configurationDocument = await this.scheme.requestHandler.axios.$get(this.scheme.options.endpoints.configuration).catch(e => Promise.reject(e))

      // Push Configuration document to state hydration
      if (process.server) {
        this.scheme.$auth.ctx.beforeNuxtRender(({ nuxtState }) => {
          nuxtState.$auth = {
            oidc: {
              configurationDocument
            }
          }
        })
      }

      this.set(configurationDocument)
    }
  }

  async init () {
    await this.request().catch(() => {
      throw new ConfigurationDocumentRequestError()
    })

    this.setSchemeEndpoints()
  }

  setSchemeEndpoints () {
    const configurationDocument = this.get()

    this.scheme.options.endpoints = defu(this.scheme.options.endpoints, {
      authorization: configurationDocument.authorization_endpoint,
      token: configurationDocument.token_endpoint,
      userInfo: configurationDocument.userinfo_endpoint,
      logout: configurationDocument.end_session_endpoint
    })
  }

  reset () {
    this._set(false)
  }
}