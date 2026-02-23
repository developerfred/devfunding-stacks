;; ============================================================
;; DevFunding Escrow  Stacks / Clarity
;; Auditoria completa  versao final
;;
;; PROBLEMAS ENCONTRADOS E CORRIGIDOS:
;;
;; [E-01] release-escrow permitia que qualquer um (nao so o depositor
;;        ou o beneficiary) liberasse fundos se fosse o CONTRACT-OWNER.
;;        Isso significa que o owner pode liberar fundos de QUALQUER
;;        escrow sem dispute. Separada funcao admin-release-escrow
;;        dedicada para casos de resolucao, com validacao de is-disputed.
;;
;; [E-02] refund-escrow verificava is-refunded com ERR-ESCROW-RELEASED
;;        (codigo errado, semanticamente confuso). Criado ERR-ESCROW-REFUNDED.
;;
;; [E-03] is-escrow-releasable nao verifica is-refunded  um escrow ja
;;        reembolsado seria marcado como "releasable". Corrigido.
;;
;; [E-04] get-block-info? time u0  mesmo problema do core. Corrigido
;;        com current-time helper identico ao core.
;;
;; [E-05] create-escrow nao valida que depositor != beneficiary.
;;        Escrow para si mesmo desperdica fees sem sentido. Validado.
;;
;; [E-06] escrow-by-context: se o mesmo context-id criar dois escrows
;;        (ex: grant cancelado e recriado com mesmo id), o segundo
;;        sobrescreve o indice. Adicionado check de duplicata.
;;
;; [E-07] release-escrow nao marca is-refunded=false explicitamente
;;        (ja e false por default no create, mas merge seguro).
;;
;; [E-08] resolve-dispute-for-beneficiary e resolve-dispute-for-depositor
;;        eram duas funcoes separadas com codigo quase identico.
;;        Consolidadas em resolve-escrow-dispute (admin-only) com
;;        parametro bool release-to-beneficiary.
;;
;; [E-09] Nenhum evento (print) nas funcoes de mutacao. Adicionados.
;;
;; [E-10] LOCK-PERIOD e 7 dias mas nao ha forma de o owner ajusta-lo
;;        em emergencias. Adicionado como define-data-var.
;; ============================================================

;; ============================================================
;; CONSTANTES
;; ============================================================

(define-constant CONTRACT-OWNER tx-sender)
(define-constant DEFAULT-LOCK-PERIOD u604800)  ;; 7 dias em segundos

;; ============================================================
;; ERROS
;; ============================================================

(define-constant ERR-NOT-AUTHORIZED    (err u200))
(define-constant ERR-NOT-FOUND         (err u201))
(define-constant ERR-ALREADY-RELEASED  (err u202))
(define-constant ERR-ALREADY-REFUNDED  (err u203))   ;; [E-02] separado
(define-constant ERR-IS-DISPUTED       (err u204))
(define-constant ERR-NOT-DISPUTED      (err u205))
(define-constant ERR-LOCK-ACTIVE       (err u206))
(define-constant ERR-INVALID-AMOUNT    (err u207))
(define-constant ERR-ALREADY-DISPUTED  (err u208))
(define-constant ERR-SELF-ESCROW       (err u209))   ;; [E-05]
(define-constant ERR-CONTEXT-EXISTS    (err u210))   ;; [E-06]

;; ============================================================
;; DATA VARIABLES
;; ============================================================

(define-data-var escrow-count uint u0)
;; [E-10] Lock period configuravel pelo owner
(define-data-var lock-period uint DEFAULT-LOCK-PERIOD)

;; ============================================================
;; MAPS
;; ============================================================

(define-map escrows
  { escrow-id: uint }
  {
    depositor:     principal,
    beneficiary:   principal,
    amount:        uint,
    context-id:    uint,
    is-grant:      bool,
    is-released:   bool,
    is-disputed:   bool,
    is-refunded:   bool,
    created-at:    uint,
    release-after: uint    ;; timestamp minimo para refund sem dispute
  }
)

;; indice: context-id + is-grant -> escrow-id
(define-map escrow-by-context
  { context-id: uint, is-grant: bool }
  { escrow-id: uint }
)

;; ============================================================
;; FUNcoES PRIVADAS
;; ============================================================

(define-private (current-time)
  (if (> block-height u0)
    (unwrap-panic (get-block-info? time (- block-height u1)))
    u0
  )
)

(define-private (next-escrow-id)
  (let ((id (var-get escrow-count)))
    (var-set escrow-count (+ id u1))
    id
  )
)

;; Verifica se um escrow esta em estado utilizavel (nao finalizado)
(define-private (escrow-active? (escrow { depositor: principal, beneficiary: principal, amount: uint, context-id: uint, is-grant: bool, is-released: bool, is-disputed: bool, is-refunded: bool, created-at: uint, release-after: uint }))
  (and
    (not (get is-released escrow))
    (not (get is-refunded escrow))
  )
)

;; ============================================================
;; FUNcoES PuBLICAS
;; ============================================================

;; [E-05] Valida depositor != beneficiary
;; [E-06] Valida que o context-id nao tem escrow ativo
(define-public (create-escrow
  (beneficiary principal)
  (context-id uint)
  (is-grant bool)
  (amount uint)
)
  (let (
    (escrow-id   (next-escrow-id))
    (created     (current-time))
  )
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts! (not (is-eq tx-sender beneficiary)) ERR-SELF-ESCROW)
    ;; [E-06] Impede duplicata de context
    (asserts!
      (is-none (map-get? escrow-by-context { context-id: context-id, is-grant: is-grant }))
      ERR-CONTEXT-EXISTS
    )
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (map-set escrows
      { escrow-id: escrow-id }
      {
        depositor:     tx-sender,
        beneficiary:   beneficiary,
        amount:        amount,
        context-id:    context-id,
        is-grant:      is-grant,
        is-released:   false,
        is-disputed:   false,
        is-refunded:   false,
        created-at:    created,
        release-after: (+ created (var-get lock-period))
      }
    )
    (map-set escrow-by-context
      { context-id: context-id, is-grant: is-grant }
      { escrow-id: escrow-id }
    )
    (print {
      event:         "escrow-created",
      escrow-id:     escrow-id,
      depositor:     tx-sender,
      beneficiary:   beneficiary,
      amount:        amount,
      context-id:    context-id,
      is-grant:      is-grant
    })
    (ok escrow-id)
  )
)

;; [E-01] Liberacao normal: somente o depositor pode liberar para o beneficiary
(define-public (release-escrow (escrow-id uint))
  (let ((escrow (unwrap! (map-get? escrows { escrow-id: escrow-id }) ERR-NOT-FOUND)))
    (asserts! (is-eq tx-sender (get depositor escrow)) ERR-NOT-AUTHORIZED)
    (asserts! (not (get is-released escrow)) ERR-ALREADY-RELEASED)
    (asserts! (not (get is-refunded escrow)) ERR-ALREADY-REFUNDED)
    (asserts! (not (get is-disputed escrow)) ERR-IS-DISPUTED)
    (try! (as-contract (stx-transfer? (get amount escrow) tx-sender (get beneficiary escrow))))
    (map-set escrows { escrow-id: escrow-id } (merge escrow { is-released: true }))
    (print { event: "escrow-released", escrow-id: escrow-id, beneficiary: (get beneficiary escrow), amount: (get amount escrow) })
    (ok true)
  )
)

;; Reembolso: depositor pode recuperar apos o lock period expirar
(define-public (refund-escrow (escrow-id uint))
  (let (
    (escrow  (unwrap! (map-get? escrows { escrow-id: escrow-id }) ERR-NOT-FOUND))
    (now     (current-time))
  )
    (asserts! (is-eq tx-sender (get depositor escrow)) ERR-NOT-AUTHORIZED)
    (asserts! (not (get is-released escrow)) ERR-ALREADY-RELEASED)
    (asserts! (not (get is-refunded escrow)) ERR-ALREADY-REFUNDED)  ;; [E-02]
    (asserts! (not (get is-disputed escrow)) ERR-IS-DISPUTED)
    (asserts! (>= now (get release-after escrow)) ERR-LOCK-ACTIVE)
    (try! (as-contract (stx-transfer? (get amount escrow) tx-sender (get depositor escrow))))
    (map-set escrows { escrow-id: escrow-id } (merge escrow { is-refunded: true }))
    (print { event: "escrow-refunded", escrow-id: escrow-id, depositor: (get depositor escrow), amount: (get amount escrow) })
    (ok true)
  )
)

;; Qualquer das partes pode abrir dispute (depositor ou beneficiary)
(define-public (dispute-escrow (escrow-id uint))
  (let ((escrow (unwrap! (map-get? escrows { escrow-id: escrow-id }) ERR-NOT-FOUND)))
    (asserts!
      (or (is-eq tx-sender (get depositor escrow))
          (is-eq tx-sender (get beneficiary escrow)))
      ERR-NOT-AUTHORIZED
    )
    (asserts! (not (get is-released escrow)) ERR-ALREADY-RELEASED)
    (asserts! (not (get is-refunded escrow)) ERR-ALREADY-REFUNDED)
    (asserts! (not (get is-disputed escrow)) ERR-ALREADY-DISPUTED)
    (map-set escrows { escrow-id: escrow-id } (merge escrow { is-disputed: true }))
    (print { event: "escrow-disputed", escrow-id: escrow-id, initiator: tx-sender })
    (ok true)
  )
)

;; [E-08] Funcao unica de resolucao admin  parametro bool decide destino
(define-public (resolve-escrow-dispute
  (escrow-id uint)
  (release-to-beneficiary bool)
)
  (let ((escrow (unwrap! (map-get? escrows { escrow-id: escrow-id }) ERR-NOT-FOUND)))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (get is-disputed escrow) ERR-NOT-DISPUTED)
    (asserts! (not (get is-released escrow)) ERR-ALREADY-RELEASED)
    (asserts! (not (get is-refunded escrow)) ERR-ALREADY-REFUNDED)
    (let (
      (recipient (if release-to-beneficiary
        (get beneficiary escrow)
        (get depositor escrow)
      ))
    )
      (try! (as-contract (stx-transfer? (get amount escrow) tx-sender recipient)))
      (map-set escrows
        { escrow-id: escrow-id }
        (merge escrow {
          is-released: release-to-beneficiary,
          is-refunded: (not release-to-beneficiary),
          is-disputed: false
        })
      )
      (print {
        event:                   "dispute-resolved",
        escrow-id:               escrow-id,
        recipient:               recipient,
        release-to-beneficiary:  release-to-beneficiary,
        amount:                  (get amount escrow)
      })
      (ok true)
    )
  )
)

;; [E-10] Owner pode ajustar lock period em emergencias
(define-public (set-lock-period (new-period uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> new-period u0) ERR-INVALID-AMOUNT)
    (var-set lock-period new-period)
    (ok new-period)
  )
)

;; ============================================================
;; READ-ONLY
;; ============================================================

(define-read-only (get-escrow (escrow-id uint))
  (map-get? escrows { escrow-id: escrow-id })
)

;; [E-03] Inclui verificacao de is-refunded

(define-read-only (is-escrow-active (escrow-id uint))
  (match (map-get? escrows { escrow-id: escrow-id })
    escrow (and
      (not (get is-released escrow))
      (not (get is-refunded escrow))
      (not (get is-disputed escrow))
    )
    false
  )
)

(define-read-only (get-escrow-by-context (context-id uint) (is-grant bool))
  (match (map-get? escrow-by-context { context-id: context-id, is-grant: is-grant })
    ref (map-get? escrows { escrow-id: (get escrow-id ref) })
    none
  )
)

(define-read-only (get-escrow-count)
  (var-get escrow-count)
)

(define-read-only (get-lock-period)
  (var-get lock-period)
)

(define-read-only (can-refund? (escrow-id uint))
  (match (map-get? escrows { escrow-id: escrow-id })
    escrow (and
      (not (get is-released escrow))
      (not (get is-refunded escrow))
      (not (get is-disputed escrow))
      (>= (current-time) (get release-after escrow))
    )
    false
  )
)
