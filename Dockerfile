FROM hashicorp/vault:1.16

COPY ./vault/vault.hcl /vault/config/vault.hcl