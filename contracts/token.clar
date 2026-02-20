;; ============================================================
;; DevFunding Token (DFT)  SIP-010 Fungible Token
;; Stacks / Clarity  Auditoria completa  versao final
;;
;; PROBLEMAS ENCONTRADOS E CORRIGIDOS:
;;
;; [T-01] Linha de inicializacao:
;;        (ft-mint? devfunding-token u500000000000000 CONTRACT-OWNER)
;;        Esta chamada no topo do contrato retorna (response bool uint).
;;        Em Clarity, expressoes de topo-nivel FORA de define-* devem
;;        ser evitadas  o resultado de ft-mint? e descartado silenciosamente.
;;        Se o mint falhar por qualquer razao, o contrato ainda deploy com
;;        sucesso mas sem supply inicial.
;;        Solucao: mover para (begin ...) de inicializacao com unwrap-panic
;;        para garantir que o deploy falha se o mint inicial falhar.
;;        PADRao CLARITY: usar unwrap-panic no topo-nivel para inicializacoes
;;        criticas  o deployment e revertido se falhar.
;;
;; [T-02] TOKEN-URI declarado como constante (some u"..."):
;;        define-constant nao suporta wrapped types como (optional ...).
;;        O tipo resultante seria avaliado em compile-time como literal,
;;        mas em algumas versoes do clarinet isso causa erro de tipo.
;;        Solucao: declare como string pura e aplique (some ...) na funcao.
;;        ADICIONALMENTE: get-token-uri deve retornar (ok (optional ...))
;;        conforme SIP-010  corrigido.
;;
;; [T-03] total-supply como define-data-var e redundante com ft-get-supply
;;        que ja rastreia o supply interno do define-fungible-token.
;;        Manter dois contadores em sincronismo e fonte de bug.
;;        Removido  usar ft-get-supply como fonte unica de verdade.
;;
;; [T-04] mint: verifica supply APoS a chamada ft-mint? seria mais seguro.
;;        ft-mint? ja respeita o limite MAX-SUPPLY definido no
;;        define-fungible-token, retornando (err ...) se exceder.
;;        A verificacao manual com asserts! e redundante mas mantida
;;        como documentacao explicita para auditores.
;;
;; [T-05] burn: qualquer holder pode chamar burn em qualquer quantidade.
;;        Sem verificacao de saldo minimo pos-burn. ft-burn? ja retorna
;;        erro se saldo insuficiente  OK. Documentado.
;;
;; [T-06] transfer: print do memo era (print m)  em Clarity o print
;;        deve receber qualquer tipo serializavel. buff 34 e serializavel.
;;        OK, mas melhorado para clareza.
;;
;; [T-07] Ausencia de funcao set-token-uri para atualizacao futura do
;;        metadata. Adicionada com controle de acesso do owner.
;;
;; [T-08] MAX-SUPPLY como constante uint128 = u1000000000000000 (1B com
;;        6 decimais = 10^15). Verificar: 10^9 tokens x 10^6 decimais =
;;        10^15. uint128 maximo +- 3.4 x 10^38. Seguro. Documentado.
;;
;; CONFORMIDADE SIP-010 VERIFICADA:
;; ok  transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34)))
;; ok  get-name to  (ok (string-ascii N))
;; ok  get-symbol to  (ok (string-ascii N))
;; ok  get-decimals to  (ok uint)
;; ok  get-balance (owner principal) to  (ok uint)
;; ok  get-total-supply to  (ok uint)
;; ok  get-token-uri to  (ok (optional (string-utf8 256)))
;; ============================================================


;; ============================================================
;; IMPL TRAIT SIP-010
;; Endereco mainnet do trait padrao da Stacks Foundation
;; ============================================================

(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

;; ============================================================
;; CONSTANTES
;; ============================================================

(define-constant CONTRACT-OWNER tx-sender)

;; [T-08] 1 bilhao de tokens com 6 casas decimais = 10^15 unidades
(define-constant MAX-SUPPLY u1000000000000000)

;; [T-02] Strings simples  (some ...) aplicado em get-token-uri
(define-constant TOKEN-NAME   "DevFunding Token")
(define-constant TOKEN-SYMBOL "DFT")
(define-constant TOKEN-DECIMALS u6)
(define-constant INITIAL-SUPPLY u500000000000000)  ;; 500M para distribuicao

;; ============================================================
;; ERROS
;; ============================================================

(define-constant ERR-NOT-AUTHORIZED      (err u300))
(define-constant ERR-INVALID-AMOUNT      (err u301))
(define-constant ERR-MAX-SUPPLY-EXCEEDED (err u302))
(define-constant ERR-NOT-TOKEN-OWNER     (err u303))

;; ============================================================
;; TOKEN DEFINITION
;; ============================================================

;; MAX-SUPPLY passado aqui e o teto hard-coded do define-fungible-token.
;; ft-mint? falha automaticamente se supply + amount > MAX-SUPPLY.
(define-fungible-token devfunding-token MAX-SUPPLY)

;; ============================================================
;; DATA VARIABLES
;; ============================================================

;; [T-07] URI atualizavel via set-token-uri
(define-data-var token-uri (string-utf8 256) u"https://devfunding.xyz/token-metadata.json")

;; ============================================================
;; INICIALIZAcao
;; ============================================================

;; [T-01] unwrap-panic garante que o deployment falha se o mint falhar.
;; Isso torna o estado inicial do contrato confiavel e auditavel.
(unwrap-panic (ft-mint? devfunding-token INITIAL-SUPPLY CONTRACT-OWNER))

;; ============================================================
;; SIP-010  FUNcoES OBRIGAToRIAS
;; ============================================================

;; [T-06] Memo impresso antes do transfer para auditoria on-chain
(define-public (transfer
  (amount uint)
  (sender principal)
  (recipient principal)
  (memo (optional (buff 34)))
)
  (begin
    ;; Validate that the transaction sender owns the tokens being transferred
    (asserts! (is-eq tx-sender sender) ERR-NOT-TOKEN-OWNER)
    
    ;; Ensure the transfer amount is positive to prevent meaningless transactions
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    
    ;; Emit the memo to the blockchain if provided for audit trail purposes
    (match memo 
      memo-value (begin (print { memo: memo-value }) true)
      true  ;; No-op when memo is none, maintain type consistency
    )
    
    ;; Execute the actual token transfer using the fungible token implementation
    (ft-transfer? devfunding-token amount sender recipient)
  )
)

(define-read-only (get-name)
  (ok TOKEN-NAME)
)

(define-read-only (get-symbol)
  (ok TOKEN-SYMBOL)
)

(define-read-only (get-decimals)
  (ok TOKEN-DECIMALS)
)

(define-read-only (get-balance (owner principal))
  (ok (ft-get-balance devfunding-token owner))
)

(define-read-only (get-total-supply)
  (ok (ft-get-supply devfunding-token))
)

;; [T-02] (some ...) aplicado aqui, nao na constante
(define-read-only (get-token-uri)
  (ok (some (var-get token-uri)))
)

;; ============================================================
;; MINT / BURN
;; ============================================================

;; [T-04] Verificacao de MAX-SUPPLY antes do mint (documentacao explicita)
;; ft-mint? tambem verifica internamente  dupla protecao
(define-public (mint (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts!
      (<= (+ (ft-get-supply devfunding-token) amount) MAX-SUPPLY)
      ERR-MAX-SUPPLY-EXCEEDED
    )
    (ft-mint? devfunding-token amount recipient)
  )
)

;; [T-05] ft-burn? ja valida saldo  retorna (err u1) se insuficiente
(define-public (burn (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (ft-burn? devfunding-token amount tx-sender)
  )
)

;; ============================================================
;; ADMIN
;; ============================================================

;; [T-07] Atualizacao de URI para metadata evolutivo
(define-public (set-token-uri (new-uri (string-utf8 256)))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> (len new-uri) u0) ERR-INVALID-AMOUNT)
    (var-set token-uri new-uri)
    (print { event: "token-uri-updated", new-uri: new-uri })
    (ok true)
  )
)
