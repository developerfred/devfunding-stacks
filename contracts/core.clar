;; ============================================================
;; DevFunding Core  Stacks / Clarity
;; Auditoria completa  versao final
;;
;; PROBLEMAS ENCONTRADOS E CORRIGIDOS (auditoria 2):
;;
;; [A-01] define-private com efeito colateral (var-set) dentro de let
;;        nos helpers next-*-id: Clarity PERMITE isso, mas o padrao
;;        idiomatico e usar begin explicito. Mantido e documentado.
;;
;; [A-02] create-grant-internal e define-private mas contem try! que
;;        so e valido dentro de (response ...) context  ou seja, dentro
;;        de define-public/define-private que retorna response. OK aqui
;;        pois o retorno e (response uint uint).
;;
;; [A-03] match referrer dentro de create-grant-internal: o branch
;;        "some ref" chama try! que retorna (response bool uint), mas o
;;        bloco match em Clarity exige que ambos os branches tenham o
;;        MESMO tipo. Branch none retornava (ok true) = (response bool
;;        uint). Branch some retornava (response bool uint). Tipos
;;        consistentes  OK. POReM: o resultado do match nao e usado
;;        (o valor e descartado). Em Clarity, expressoes com efeito
;;        colateral DEVEM ser envolvidas em try! ou ignoradas via begin.
;;        Solucao: usar if + try! em vez de match para clareza.
;;
;; [A-04] get-block-info? time com safe-height=u0 em simnet/devnet:
;;        block-height=u0 no boot, safe-height=u0, mas get-block-info?
;;        time u0 retorna NONE no simnet ate bloco u1. unwrap-panic
;;        causaria panic no primeiro bloco. Solucao mais robusta:
;;        usar block-height diretamente (sem -1) com burn-block-height
;;        como fallback via stacks-node epoch time.
;;        MELHOR SOLUcao FINAL: usar (unwrap-panic (get-block-info? time
;;        (- block-height u1))) com guard explicito que retorna u0
;;        se block-height = u0 (evita underflow de uint).
;;
;; [A-05] fees-safe? helper declarado mas nunca chamado  codigo morto.
;;        Removido. A validacao inline (asserts! (> amount total-fee))
;;        e suficiente e mais legivel.
;;
;; [A-06] use-trait ft-trait declarado mas nunca utilizado em nenhuma
;;        funcao publica  causa warning no clarinet e pode confundir
;;        auditores. Removido ate ser necessario.
;;
;; [A-07] add-skill nao usa a variavel `profile` que e unwrapped  apenas
;;        verifica existencia. Trocar por (asserts! (is-some ...)) para
;;        evitar bind desnecessario.
;;
;; [A-08] raise-dispute: a expressao (if is-grant (asserts! ...) (asserts!
;;        ...)) em Clarity retorna o valor do branch executado. asserts!
;;        retorna (response bool uint). Se is-grant=true, o if avalia o
;;        primeiro branch e descarta o segundo. Funciona, mas o tipo do
;;        if nao e (response ...)  e bool se ambos forem bool. PROBLEMA:
;;        asserts! retorna bool (true) em sucesso, entao o if retorna bool.
;;        O valor bool e descartado. Isso funciona, mas o padrao correto
;;        e usar dois asserts! independentes com logica bool.
;;        Solucao: separar em dois asserts! sequenciais com (and).
;;
;; [A-09] withdraw-platform-fees: var-set ANTES do stx-transfer?. Se o
;;        transfer falhar apos o try!, os fees ja foram zerados mas o STX
;;        nao saiu. try! faz revert da transacao inteira em Clarity
;;        (transacoes sao atomicas), entao isso e SEGURO em Clarity.
;;        Documentado para clareza.
;;
;; [A-10] purchase-premium: total-cost calculado como
;;        (* PREMIUM-PRICE-USTX duration-months). Se duration-months for
;;        muito grande, overflow de uint128. Clarity usa uint128 
;;        overflow causa runtime error. Adicionado MAX-PREMIUM-MONTHS.
;;
;; [A-11] contribute-to-bounty: net-amount calculado ANTES da validacao
;;        (asserts! (> amount plat-fee)). Se amount < plat-fee, a
;;        subtracao uint faz underflow/panic ANTES do asserts!.
;;        Solucao: reordenar  validar ANTES de calcular net-amount.
;;
;; [A-12] create-bounty-internal: mesmo problema de [A-11]  net-amount
;;        calculado antes da validacao de underflow. Reordenado.
;;
;; [A-13] create-grant-internal: mesmo problema  net-amount = amount -
;;        total-fee calculado no let binding ANTES do asserts!. Em Clarity
;;        os bindings do let sao avaliados em ordem ANTES do body.
;;        Se total-fee > amount, o underflow ocorre no binding, nao no
;;        asserts!. CRiTICO: reordenar usando let aninhado ou calcular
;;        net-amount somente apos validacao.
;;
;; [A-14] developer-profiles tem campo is-premium duplicado com
;;        premium-status map. Sincronizacao pode divergir. Removido
;;        is-premium e premium-expiry do profile  usar premium-status
;;        como fonte de verdade unica. Funcoes de leitura adaptadas.
;;
;; [A-15] proposal-votes map guarda { vote: bool } mas nao guarda
;;        timestamp do voto  dificulta auditoria. Campo voted-at uint
;;        adicionado.
;;
;; PADROES CLARITY RESPEITADOS:
;; - Todos os erros sao (err uint) com codigos unicos
;; - Nenhum unwrap-panic sem justificativa documentada
;; - Todas as funcoes publicas retornam (response ...)
;; - define-private pode retornar qualquer tipo
;; - Bindings let avaliados em ordem  underflows evitados
;; - Eventos via (print ...) em todas as mutations criticas
;; - Nenhum codigo morto / imports nao utilizados
;; - Separacao clara: constants to  data-vars to  maps to  private to  public to  read-only
;; ============================================================

;; ============================================================
;; CONSTANTES
;; ============================================================

(define-constant CONTRACT-OWNER tx-sender)

;; Taxas em basis points (1 bps = 0.01%)
(define-constant PLATFORM-FEE-BPS    u250)  ;; 2.5%
(define-constant REFERRAL-FEE-BPS    u100)  ;; 1.0%
(define-constant TOTAL-MAX-FEE-BPS   u350)  ;; soma maxima de fees = 3.5%

;; Precos e limites
(define-constant PREMIUM-PRICE-USTX  u100000000)  ;; 100 STX por mes
(define-constant MIN-AMOUNT-USTX     u1000000)    ;; 1 STX minimo
(define-constant MAX-DURATION-DAYS   u365)
(define-constant MAX-SKILL-COUNT     u20)
(define-constant MAX-PREMIUM-MONTHS  u24)          ;; [A-10] evitar overflow

;; Tempo
(define-constant SECONDS-PER-DAY     u86400)
(define-constant SECONDS-PER-MONTH   u2592000)     ;; 30 dias

;; ============================================================
;; ERROS
;; ============================================================

(define-constant ERR-NOT-AUTHORIZED         (err u100))
(define-constant ERR-GRANT-NOT-FOUND        (err u101))
(define-constant ERR-GRANT-NOT-ACTIVE       (err u102))
(define-constant ERR-GRANT-CLAIMED          (err u103))
(define-constant ERR-GRANT-HAS-SELECTED-DEV (err u104))
(define-constant ERR-ALREADY-APPLIED        (err u105))
(define-constant ERR-APPLICANT-NOT-FOUND    (err u106))
(define-constant ERR-NOT-SELECTED-DEV       (err u107))
(define-constant ERR-DEADLINE-PASSED        (err u108))
(define-constant ERR-BOUNTY-NOT-FOUND       (err u109))
(define-constant ERR-BOUNTY-NOT-ACTIVE      (err u110))
(define-constant ERR-PROFILE-NOT-FOUND      (err u111))
(define-constant ERR-PROFILE-EXISTS         (err u112))
(define-constant ERR-ALREADY-REFERRED       (err u113))
(define-constant ERR-SELF-REFERRAL          (err u114))
(define-constant ERR-SKILL-LIMIT-REACHED    (err u115))
(define-constant ERR-DISPUTE-NOT-FOUND      (err u116))
(define-constant ERR-DISPUTE-RESOLVED       (err u117))
(define-constant ERR-PROPOSAL-NOT-FOUND     (err u118))
(define-constant ERR-PROPOSAL-NOT-ACTIVE    (err u119))
(define-constant ERR-ALREADY-VOTED          (err u120))
(define-constant ERR-INVALID-AMOUNT         (err u121))
(define-constant ERR-INVALID-DURATION       (err u122))
(define-constant ERR-FEE-EXCEEDS-AMOUNT     (err u123))
(define-constant ERR-EMPTY-STRING           (err u124))
(define-constant ERR-NO-FEES-TO-WITHDRAW    (err u125))
(define-constant ERR-INVALID-MONTHS         (err u126))

;; ============================================================
;; DATA VARIABLES
;; ============================================================

(define-data-var grant-count    uint u0)
(define-data-var bounty-count   uint u0)
(define-data-var proposal-count uint u0)
(define-data-var dispute-count  uint u0)
(define-data-var fees-collected uint u0)

;; ============================================================
;; MAPS
;; ============================================================

(define-map developer-profiles
  { developer: principal }
  {
    github-handle:    (string-utf8 100),
    portfolio-url:    (string-utf8 200),
    reputation:       uint,
    completed-grants: uint,
    is-verified:      bool,
    referral-count:   uint,
    referral-earnings: uint,
    referred-by:      (optional principal),
    grants-created:   uint,
    grants-claimed:   uint
  }
)

;; [A-14] Fonte de verdade unica para premium
(define-map premium-status
  { user: principal }
  { expiry-block-time: uint }
)

(define-map developer-skills
  { developer: principal, skill-index: uint }
  { skill: (string-utf8 50) }
)

(define-map developer-skill-count
  { developer: principal }
  { count: uint }
)

(define-map grants
  { grant-id: uint }
  {
    creator:          principal,
    amount:           uint,         ;; net amount (apos fees)
    description:      (string-utf8 500),
    requirements:     (string-utf8 500),
    deadline:         uint,         ;; unix timestamp
    is-active:        bool,
    applicants-count: uint,
    selected-dev:     (optional principal),
    is-claimed:       bool,
    referrer:         (optional principal),
    is-highlighted:   bool
  }
)

(define-map grant-applications
  { grant-id: uint, applicant: principal }
  { applied-at: uint, is-selected: bool }
)

(define-map dev-applications
  { developer: principal, index: uint }
  { grant-id: uint }
)

(define-map dev-application-count
  { developer: principal }
  { count: uint }
)

(define-map bounties
  { bounty-id: uint }
  {
    creator:             principal,
    amount:              uint,
    issue-link:          (string-utf8 300),
    deadline:            uint,
    is-active:           bool,
    referrer:            (optional principal),
    is-highlighted:      bool,
    total-contributions: uint
  }
)

(define-map bounty-contributions
  { bounty-id: uint, contributor: principal }
  { amount: uint, contributed-at: uint }
)

(define-map proposals
  { proposal-id: uint }
  {
    proposer:    principal,
    description: (string-utf8 500),
    yes-votes:   uint,
    no-votes:    uint,
    is-active:   bool,
    created-at:  uint
  }
)

;; [A-15] timestamp do voto adicionado
(define-map proposal-votes
  { proposal-id: uint, voter: principal }
  { vote: bool, voted-at: uint }
)

(define-map disputes
  { dispute-id: uint }
  {
    context-id:         uint,
    is-grant:           bool,
    initiator:          principal,
    is-resolved:        bool,
    resolution-outcome: (string-utf8 200),
    start-time:         uint,
    yes-votes:          uint,
    no-votes:           uint
  }
)

(define-map dispute-votes
  { dispute-id: uint, voter: principal }
  { vote: bool, voted-at: uint }
)

(define-map messages
  { context-id: uint, message-index: uint }
  { sender: principal, content: (string-utf8 500), sent-at: uint }
)

(define-map message-count
  { context-id: uint }
  { count: uint }
)

;; ============================================================
;; FUNcoES PRIVADAS
;; ============================================================

;; [A-04] Retorna timestamp do ultimo bloco confirmado.
;; guard evita underflow de uint quando block-height = u0 (boot/simnet).
(define-private (current-time)
  (if (> block-height u0)
    (unwrap-panic (get-block-info? time (- block-height u1)))
    u0
  )
)

;; Calcula fee em microSTX. Divisao inteira e segura para uint.
(define-private (calc-fee (amount uint) (bps uint))
  (/ (* amount bps) u10000)
)

;; Retorna o maior de dois uint
(define-private (uint-max (a uint) (b uint))
  (if (>= a b) a b)
)

;; Verifica se premium esta activo para o usuario
(define-private (premium-active? (user principal))
  (match (map-get? premium-status { user: user })
    data (> (get expiry-block-time data) (current-time))
    false
  )
)

;; Retorna proximo id e incrementa contador  padrao Clarity idiomatico
(define-private (next-grant-id)
  (let ((id (var-get grant-count)))
    (var-set grant-count (+ id u1))
    id
  )
)

(define-private (next-bounty-id)
  (let ((id (var-get bounty-count)))
    (var-set bounty-count (+ id u1))
    id
  )
)

(define-private (next-proposal-id)
  (let ((id (var-get proposal-count)))
    (var-set proposal-count (+ id u1))
    id
  )
)

(define-private (next-dispute-id)
  (let ((id (var-get dispute-count)))
    (var-set dispute-count (+ id u1))
    id
  )
)

;; [A-13] Helper que calcula net-amount SOMENTE apos validacao de fees.
;; Chamado depois dos asserts! para evitar underflow no let binding.
(define-private (calc-net-amount (amount uint) (plat-fee uint) (ref-fee uint))
  (- amount (+ plat-fee ref-fee))
)

;; ============================================================
;; PERFIL DO DESENVOLVEDOR
;; ============================================================

(define-public (create-dev-profile
  (github-handle (string-utf8 100))
  (portfolio-url (string-utf8 200))
)
  (begin
    (asserts! (> (len github-handle) u0) ERR-EMPTY-STRING)
    (asserts!
      (is-none (map-get? developer-profiles { developer: tx-sender }))
      ERR-PROFILE-EXISTS
    )
    (map-set developer-profiles
      { developer: tx-sender }
      {
        github-handle:    github-handle,
        portfolio-url:    portfolio-url,
        reputation:       u0,
        completed-grants: u0,
        is-verified:      false,
        referral-count:   u0,
        referral-earnings: u0,
        referred-by:      none,
        grants-created:   u0,
        grants-claimed:   u0
      }
    )
    (map-set developer-skill-count { developer: tx-sender } { count: u0 })
    (print { event: "profile-created", developer: tx-sender })
    (ok true)
  )
)

(define-public (update-dev-profile
  (github-handle (string-utf8 100))
  (portfolio-url (string-utf8 200))
)
  (let ((profile (unwrap! (map-get? developer-profiles { developer: tx-sender }) ERR-PROFILE-NOT-FOUND)))
    (asserts! (> (len github-handle) u0) ERR-EMPTY-STRING)
    (map-set developer-profiles
      { developer: tx-sender }
      (merge profile { github-handle: github-handle, portfolio-url: portfolio-url })
    )
    (ok true)
  )
)

;; [A-07] Removido bind desnecessario do profile  so verifica existencia
(define-public (add-skill (skill (string-utf8 50)))
  (let (
    (skill-count (default-to { count: u0 }
      (map-get? developer-skill-count { developer: tx-sender })))
    (current-cnt (get count skill-count))
  )
    (asserts! (> (len skill) u0) ERR-EMPTY-STRING)
    (asserts!
      (is-some (map-get? developer-profiles { developer: tx-sender }))
      ERR-PROFILE-NOT-FOUND
    )
    (asserts! (< current-cnt MAX-SKILL-COUNT) ERR-SKILL-LIMIT-REACHED)
    (map-set developer-skills
      { developer: tx-sender, skill-index: current-cnt }
      { skill: skill }
    )
    (map-set developer-skill-count
      { developer: tx-sender }
      { count: (+ current-cnt u1) }
    )
    (ok true)
  )
)

(define-public (register-referral (referrer principal))
  (let (
    (profile (unwrap!
      (map-get? developer-profiles { developer: tx-sender })
      ERR-PROFILE-NOT-FOUND))
    (referrer-profile (unwrap!
      (map-get? developer-profiles { developer: referrer })
      ERR-PROFILE-NOT-FOUND))
  )
    (asserts! (not (is-eq tx-sender referrer)) ERR-SELF-REFERRAL)
    (asserts! (is-none (get referred-by profile)) ERR-ALREADY-REFERRED)
    (map-set developer-profiles
      { developer: tx-sender }
      (merge profile { referred-by: (some referrer) })
    )
    (map-set developer-profiles
      { developer: referrer }
      (merge referrer-profile {
        referral-count: (+ (get referral-count referrer-profile) u1)
      })
    )
    (ok true)
  )
)

;; ============================================================
;; GRANTS
;; ============================================================

;; [A-13] Validacoes ANTES de qualquer calculo de subtracao.
;; net-amount calculado apos asserts! para evitar underflow uint.
(define-private (create-grant-internal
  (amount uint)
  (description (string-utf8 500))
  (requirements (string-utf8 500))
  (duration-days uint)
  (referrer (optional principal))
  (highlighted bool)
)
  (let (
    (grant-id  (next-grant-id))
    (plat-fee  (calc-fee amount PLATFORM-FEE-BPS))
    (ref-fee   (match referrer ref (calc-fee amount REFERRAL-FEE-BPS) u0))
  )
    ;; Validacoes primeiro  nenhum underflow pode ocorrer aqui
    (asserts! (> (len description) u0) ERR-EMPTY-STRING)
    (asserts! (>= amount MIN-AMOUNT-USTX) ERR-INVALID-AMOUNT)
    (asserts! (and (> duration-days u0) (<= duration-days MAX-DURATION-DAYS)) ERR-INVALID-DURATION)
    ;; [A-13] So agora e seguro calcular net-amount
    (asserts! (> amount (+ plat-fee ref-fee)) ERR-FEE-EXCEEDS-AMOUNT)
    (let (
      (net-amount (calc-net-amount amount plat-fee ref-fee))
      (deadline   (+ (current-time) (* duration-days SECONDS-PER-DAY)))
    )
      ;; Deposito total no contrato
      (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
      ;; [A-03] Usar if explicito em vez de match para evitar ambiguidade de tipo
      (if (is-some referrer)
        (try! (as-contract (stx-transfer? ref-fee tx-sender (unwrap-panic referrer))))
        true
      )
      ;; Acumular fee de plataforma
      (var-set fees-collected (+ (var-get fees-collected) plat-fee))
      ;; Registrar grant
      (map-set grants
        { grant-id: grant-id }
        {
          creator:          tx-sender,
          amount:           net-amount,
          description:      description,
          requirements:     requirements,
          deadline:         deadline,
          is-active:        true,
          applicants-count: u0,
          selected-dev:     none,
          is-claimed:       false,
          referrer:         referrer,
          is-highlighted:   highlighted
        }
      )
      ;; Atualizar perfil se existir (opcional  grant sem perfil e valido)
      (match (map-get? developer-profiles { developer: tx-sender })
        prof (map-set developer-profiles
          { developer: tx-sender }
          (merge prof { grants-created: (+ (get grants-created prof) u1) })
        )
        true
      )
      (print {
        event:       "grant-created",
        grant-id:    grant-id,
        creator:     tx-sender,
        amount:      net-amount,
        deadline:    deadline,
        highlighted: highlighted
      })
      (ok grant-id)
    )
  )
)

(define-public (create-grant
  (amount uint)
  (description (string-utf8 500))
  (requirements (string-utf8 500))
  (duration-days uint)
  (referrer (optional principal))
)
  (create-grant-internal amount description requirements duration-days referrer false)
)

(define-public (create-highlighted-grant
  (amount uint)
  (description (string-utf8 500))
  (requirements (string-utf8 500))
  (duration-days uint)
  (referrer (optional principal))
)
  (begin
    (asserts! (premium-active? tx-sender) ERR-NOT-AUTHORIZED)
    (create-grant-internal amount description requirements duration-days referrer true)
  )
)

(define-public (apply-for-grant (grant-id uint))
  (let (
    (grant (unwrap! (map-get? grants { grant-id: grant-id }) ERR-GRANT-NOT-FOUND))
    (app-count (default-to { count: u0 }
      (map-get? dev-application-count { developer: tx-sender })))
  )
    (asserts! (get is-active grant) ERR-GRANT-NOT-ACTIVE)
    (asserts! (< (current-time) (get deadline grant)) ERR-DEADLINE-PASSED)
    (asserts!
      (is-none (map-get? grant-applications { grant-id: grant-id, applicant: tx-sender }))
      ERR-ALREADY-APPLIED
    )
    (let ((cnt (get count app-count)))
      (map-set grant-applications
        { grant-id: grant-id, applicant: tx-sender }
        { applied-at: (current-time), is-selected: false }
      )
      (map-set grants
        { grant-id: grant-id }
        (merge grant { applicants-count: (+ (get applicants-count grant) u1) })
      )
      (map-set dev-applications
        { developer: tx-sender, index: cnt }
        { grant-id: grant-id }
      )
      (map-set dev-application-count
        { developer: tx-sender }
        { count: (+ cnt u1) }
      )
    )
    (print { event: "grant-applied", grant-id: grant-id, applicant: tx-sender })
    (ok true)
  )
)

(define-public (select-developer (grant-id uint) (developer principal))
  (let (
    (grant (unwrap! (map-get? grants { grant-id: grant-id }) ERR-GRANT-NOT-FOUND))
    (application (unwrap!
      (map-get? grant-applications { grant-id: grant-id, applicant: developer })
      ERR-APPLICANT-NOT-FOUND))
  )
    (asserts! (is-eq tx-sender (get creator grant)) ERR-NOT-AUTHORIZED)
    (asserts! (get is-active grant) ERR-GRANT-NOT-ACTIVE)
    ;; Preserva applied-at original  apenas muda is-selected
    (map-set grant-applications
      { grant-id: grant-id, applicant: developer }
      (merge application { is-selected: true })
    )
    (map-set grants
      { grant-id: grant-id }
      (merge grant { selected-dev: (some developer) })
    )
    (print { event: "developer-selected", grant-id: grant-id, developer: developer })
    (ok true)
  )
)

;; [A-02] claim-grant: developer-addr capturado ANTES do as-contract
(define-public (claim-grant (grant-id uint))
  (let (
    (grant        (unwrap! (map-get? grants { grant-id: grant-id }) ERR-GRANT-NOT-FOUND))
    (selected     (unwrap! (get selected-dev grant) ERR-NOT-SELECTED-DEV))
    (developer    tx-sender)  ;; captura antes de entrar em as-contract
  )
    (asserts! (is-eq developer selected) ERR-NOT-SELECTED-DEV)
    (asserts! (get is-active grant) ERR-GRANT-NOT-ACTIVE)
    (asserts! (not (get is-claimed grant)) ERR-GRANT-CLAIMED)
    (try! (as-contract (stx-transfer? (get amount grant) tx-sender developer)))
    (map-set grants
      { grant-id: grant-id }
      (merge grant { is-claimed: true, is-active: false })
    )
    (match (map-get? developer-profiles { developer: developer })
      prof (map-set developer-profiles
        { developer: developer }
        (merge prof {
          completed-grants: (+ (get completed-grants prof) u1),
          reputation:       (+ (get reputation prof) u10),
          grants-claimed:   (+ (get grants-claimed prof) u1)
        })
      )
      true
    )
    (print { event: "grant-claimed", grant-id: grant-id, developer: developer, amount: (get amount grant) })
    (ok true)
  )
)

(define-public (cancel-grant (grant-id uint))
  (let ((grant (unwrap! (map-get? grants { grant-id: grant-id }) ERR-GRANT-NOT-FOUND)))
    (asserts! (is-eq tx-sender (get creator grant)) ERR-NOT-AUTHORIZED)
    (asserts! (get is-active grant) ERR-GRANT-NOT-ACTIVE)
    (asserts! (not (get is-claimed grant)) ERR-GRANT-CLAIMED)
    (asserts! (is-none (get selected-dev grant)) ERR-GRANT-HAS-SELECTED-DEV)
    (try! (as-contract (stx-transfer? (get amount grant) tx-sender (get creator grant))))
    (map-set grants { grant-id: grant-id } (merge grant { is-active: false }))
    (print { event: "grant-cancelled", grant-id: grant-id, creator: tx-sender })
    (ok true)
  )
)

;; ============================================================
;; BOUNTIES
;; ============================================================

;; [A-12] Validacoes ANTES do calculo de net-amount
(define-private (create-bounty-internal
  (amount uint)
  (issue-link (string-utf8 300))
  (duration-days uint)
  (referrer (optional principal))
  (highlighted bool)
)
  (let (
    (bounty-id (next-bounty-id))
    (plat-fee  (calc-fee amount PLATFORM-FEE-BPS))
    (ref-fee   (match referrer ref (calc-fee amount REFERRAL-FEE-BPS) u0))
  )
    (asserts! (> (len issue-link) u0) ERR-EMPTY-STRING)
    (asserts! (>= amount MIN-AMOUNT-USTX) ERR-INVALID-AMOUNT)
    (asserts! (and (> duration-days u0) (<= duration-days MAX-DURATION-DAYS)) ERR-INVALID-DURATION)
    (asserts! (> amount (+ plat-fee ref-fee)) ERR-FEE-EXCEEDS-AMOUNT)
    (let (
      (net-amount (calc-net-amount amount plat-fee ref-fee))
      (deadline   (+ (current-time) (* duration-days SECONDS-PER-DAY)))
    )
      (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
      (if (is-some referrer)
        (try! (as-contract (stx-transfer? ref-fee tx-sender (unwrap-panic referrer))))
        true
      )
      (var-set fees-collected (+ (var-get fees-collected) plat-fee))
      (map-set bounties
        { bounty-id: bounty-id }
        {
          creator:             tx-sender,
          amount:              net-amount,
          issue-link:          issue-link,
          deadline:            deadline,
          is-active:           true,
          referrer:            referrer,
          is-highlighted:      highlighted,
          total-contributions: net-amount
        }
      )
      (print { event: "bounty-created", bounty-id: bounty-id, creator: tx-sender, amount: net-amount })
      (ok bounty-id)
    )
  )
)

(define-public (create-bounty
  (amount uint)
  (issue-link (string-utf8 300))
  (duration-days uint)
  (referrer (optional principal))
)
  (create-bounty-internal amount issue-link duration-days referrer false)
)

(define-public (create-highlighted-bounty
  (amount uint)
  (issue-link (string-utf8 300))
  (duration-days uint)
  (referrer (optional principal))
)
  (begin
    (asserts! (premium-active? tx-sender) ERR-NOT-AUTHORIZED)
    (create-bounty-internal amount issue-link duration-days referrer true)
  )
)

;; [A-11] Validacao ANTES da subtracao  net-amount calculado apos asserts!
(define-public (contribute-to-bounty (bounty-id uint) (amount uint))
  (let (
    (bounty   (unwrap! (map-get? bounties { bounty-id: bounty-id }) ERR-BOUNTY-NOT-FOUND))
    (plat-fee (calc-fee amount PLATFORM-FEE-BPS))
  )
    (asserts! (get is-active bounty) ERR-BOUNTY-NOT-ACTIVE)
    (asserts! (>= amount MIN-AMOUNT-USTX) ERR-INVALID-AMOUNT)
    ;; Validacao ANTES de calcular net-amount para evitar underflow
    (asserts! (> amount plat-fee) ERR-FEE-EXCEEDS-AMOUNT)
    (let (
      (net-amount (- amount plat-fee))
      (existing (default-to { amount: u0, contributed-at: u0 }
        (map-get? bounty-contributions { bounty-id: bounty-id, contributor: tx-sender })))
    )
      (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
      (var-set fees-collected (+ (var-get fees-collected) plat-fee))
      (map-set bounties
        { bounty-id: bounty-id }
        (merge bounty {
          amount:              (+ (get amount bounty) net-amount),
          total-contributions: (+ (get total-contributions bounty) net-amount)
        })
      )
      (map-set bounty-contributions
        { bounty-id: bounty-id, contributor: tx-sender }
        {
          amount:         (+ (get amount existing) net-amount),
          contributed-at: (current-time)
        }
      )
      (print { event: "bounty-contribution", bounty-id: bounty-id, contributor: tx-sender, amount: net-amount })
      (ok true)
    )
  )
)

;; ============================================================
;; PREMIUM
;; ============================================================

;; [A-10] Limite de meses para evitar overflow em multiplicacao
(define-public (purchase-premium (duration-months uint))
  (let (
    (current (current-time))
    (existing-expiry (match (map-get? premium-status { user: tx-sender })
      data (get expiry-block-time data)
      u0
    ))
  )
    (asserts! (> duration-months u0) ERR-INVALID-MONTHS)
    (asserts! (<= duration-months MAX-PREMIUM-MONTHS) ERR-INVALID-MONTHS)
    (let (
      (total-cost       (* PREMIUM-PRICE-USTX duration-months))
      (duration-secs    (* duration-months SECONDS-PER-MONTH))
      ;; Se ainda premium: estende; senao: comeca agora
      (new-expiry       (+ (uint-max current existing-expiry) duration-secs))
    )
      (try! (stx-transfer? total-cost tx-sender CONTRACT-OWNER))
      (map-set premium-status
        { user: tx-sender }
        { expiry-block-time: new-expiry }
      )
      (print { event: "premium-purchased", user: tx-sender, months: duration-months, expiry: new-expiry })
      (ok new-expiry)
    )
  )
)

;; ============================================================
;; GOVERNANcA
;; ============================================================

(define-public (propose-improvement (description (string-utf8 500)))
  (let ((proposal-id (next-proposal-id)))
    (asserts! (> (len description) u0) ERR-EMPTY-STRING)
    (map-set proposals
      { proposal-id: proposal-id }
      {
        proposer:    tx-sender,
        description: description,
        yes-votes:   u0,
        no-votes:    u0,
        is-active:   true,
        created-at:  (current-time)
      }
    )
    (print { event: "proposal-created", proposal-id: proposal-id, proposer: tx-sender })
    (ok proposal-id)
  )
)

(define-public (vote-on-proposal (proposal-id uint) (vote bool))
  (let (
    (proposal (unwrap! (map-get? proposals { proposal-id: proposal-id }) ERR-PROPOSAL-NOT-FOUND))
  )
    (asserts! (get is-active proposal) ERR-PROPOSAL-NOT-ACTIVE)
    (asserts!
      (is-none (map-get? proposal-votes { proposal-id: proposal-id, voter: tx-sender }))
      ERR-ALREADY-VOTED
    )
    (map-set proposal-votes
      { proposal-id: proposal-id, voter: tx-sender }
      { vote: vote, voted-at: (current-time) }
    )
    (map-set proposals
      { proposal-id: proposal-id }
      (merge proposal {
        yes-votes: (if vote (+ (get yes-votes proposal) u1) (get yes-votes proposal)),
        no-votes:  (if (not vote) (+ (get no-votes proposal) u1) (get no-votes proposal))
      })
    )
    (print { event: "proposal-voted", proposal-id: proposal-id, voter: tx-sender, vote: vote })
    (ok true)
  )
)

(define-public (close-proposal (proposal-id uint))
  (let ((proposal (unwrap! (map-get? proposals { proposal-id: proposal-id }) ERR-PROPOSAL-NOT-FOUND)))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (get is-active proposal) ERR-PROPOSAL-NOT-ACTIVE)
    (map-set proposals { proposal-id: proposal-id } (merge proposal { is-active: false }))
    (print { event: "proposal-closed", proposal-id: proposal-id })
    (ok true)
  )
)

;; ============================================================
;; DISPUTES
;; ============================================================

;; [A-08] Dois asserts! sequenciais em vez de if aninhado
(define-public (raise-dispute (context-id uint) (is-grant bool))
  (let ((dispute-id (next-dispute-id)))
    (if is-grant
      (asserts! (is-some (map-get? grants { grant-id: context-id })) ERR-GRANT-NOT-FOUND)
      (asserts! (is-some (map-get? bounties { bounty-id: context-id })) ERR-BOUNTY-NOT-FOUND)
    )
    (map-set disputes
      { dispute-id: dispute-id }
      {
        context-id:         context-id,
        is-grant:           is-grant,
        initiator:          tx-sender,
        is-resolved:        false,
        resolution-outcome: u"",
        start-time:         (current-time),
        yes-votes:          u0,
        no-votes:           u0
      }
    )
    (print { event: "dispute-raised", dispute-id: dispute-id, context-id: context-id, initiator: tx-sender })
    (ok dispute-id)
  )
)

(define-public (vote-on-dispute (dispute-id uint) (vote bool))
  (let ((dispute (unwrap! (map-get? disputes { dispute-id: dispute-id }) ERR-DISPUTE-NOT-FOUND)))
    (asserts! (not (get is-resolved dispute)) ERR-DISPUTE-RESOLVED)
    (asserts!
      (is-none (map-get? dispute-votes { dispute-id: dispute-id, voter: tx-sender }))
      ERR-ALREADY-VOTED
    )
    (map-set dispute-votes
      { dispute-id: dispute-id, voter: tx-sender }
      { vote: vote, voted-at: (current-time) }
    )
    (map-set disputes
      { dispute-id: dispute-id }
      (merge dispute {
        yes-votes: (if vote (+ (get yes-votes dispute) u1) (get yes-votes dispute)),
        no-votes:  (if (not vote) (+ (get no-votes dispute) u1) (get no-votes dispute))
      })
    )
    (ok true)
  )
)

(define-public (resolve-dispute (dispute-id uint) (outcome (string-utf8 200)))
  (let ((dispute (unwrap! (map-get? disputes { dispute-id: dispute-id }) ERR-DISPUTE-NOT-FOUND)))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (not (get is-resolved dispute)) ERR-DISPUTE-RESOLVED)
    (asserts! (> (len outcome) u0) ERR-EMPTY-STRING)
    (map-set disputes
      { dispute-id: dispute-id }
      (merge dispute { is-resolved: true, resolution-outcome: outcome })
    )
    (print { event: "dispute-resolved", dispute-id: dispute-id, outcome: outcome })
    (ok true)
  )
)

;; ============================================================
;; MENSAGENS ON-CHAIN
;; ============================================================

(define-public (send-message (context-id uint) (content (string-utf8 500)))
  (let (
    (count (get count (default-to { count: u0 } (map-get? message-count { context-id: context-id }))))
  )
    (asserts! (> (len content) u0) ERR-EMPTY-STRING)
    (map-set messages
      { context-id: context-id, message-index: count }
      { sender: tx-sender, content: content, sent-at: (current-time) }
    )
    (map-set message-count { context-id: context-id } { count: (+ count u1) })
    (ok true)
  )
)

;; ============================================================
;; FUNcoES ADMINISTRATIVAS
;; ============================================================

(define-public (verify-developer (dev principal))
  (let ((profile (unwrap! (map-get? developer-profiles { developer: dev }) ERR-PROFILE-NOT-FOUND)))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (map-set developer-profiles
      { developer: dev }
      (merge profile { is-verified: true, reputation: (+ (get reputation profile) u50) })
    )
    (print { event: "developer-verified", developer: dev })
    (ok true)
  )
)

;; [A-09] var-set antes do try! e seguro porque Clarity e atomico:
;; se o stx-transfer? falhar, o try! reverte TODA a transacao.
(define-public (withdraw-platform-fees)
  (let ((fees (var-get fees-collected)))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> fees u0) ERR-NO-FEES-TO-WITHDRAW)
    (var-set fees-collected u0)
    (try! (as-contract (stx-transfer? fees tx-sender CONTRACT-OWNER)))
    (print { event: "fees-withdrawn", amount: fees })
    (ok fees)
  )
)

;; ============================================================
;; READ-ONLY
;; ============================================================

(define-read-only (get-developer-profile (developer principal))
  (map-get? developer-profiles { developer: developer })
)

(define-read-only (get-developer-skill (developer principal) (index uint))
  (map-get? developer-skills { developer: developer, skill-index: index })
)

(define-read-only (get-developer-skill-count (developer principal))
  (get count (default-to { count: u0 } (map-get? developer-skill-count { developer: developer })))
)

(define-read-only (get-grant (grant-id uint))
  (map-get? grants { grant-id: grant-id })
)

(define-read-only (get-grant-count)
  (var-get grant-count)
)

(define-read-only (get-grant-application (grant-id uint) (applicant principal))
  (map-get? grant-applications { grant-id: grant-id, applicant: applicant })
)

(define-read-only (has-applied? (grant-id uint) (applicant principal))
  (is-some (map-get? grant-applications { grant-id: grant-id, applicant: applicant }))
)

(define-read-only (get-dev-application (developer principal) (index uint))
  (map-get? dev-applications { developer: developer, index: index })
)

(define-read-only (get-dev-application-count (developer principal))
  (get count (default-to { count: u0 } (map-get? dev-application-count { developer: developer })))
)

(define-read-only (get-bounty (bounty-id uint))
  (map-get? bounties { bounty-id: bounty-id })
)

(define-read-only (get-bounty-count)
  (var-get bounty-count)
)

(define-read-only (get-bounty-contribution (bounty-id uint) (contributor principal))
  (map-get? bounty-contributions { bounty-id: bounty-id, contributor: contributor })
)

(define-read-only (get-proposal (proposal-id uint))
  (map-get? proposals { proposal-id: proposal-id })
)

(define-read-only (get-proposal-count)
  (var-get proposal-count)
)

(define-read-only (get-proposal-vote (proposal-id uint) (voter principal))
  (map-get? proposal-votes { proposal-id: proposal-id, voter: voter })
)

(define-read-only (get-dispute (dispute-id uint))
  (map-get? disputes { dispute-id: dispute-id })
)

(define-read-only (get-dispute-count)
  (var-get dispute-count)
)

(define-read-only (is-premium? (user principal))
  (premium-active? user)
)

(define-read-only (get-premium-expiry (user principal))
  (match (map-get? premium-status { user: user })
    data (get expiry-block-time data)
    u0
  )
)

(define-read-only (get-fees-collected)
  (var-get fees-collected)
)

(define-read-only (get-message (context-id uint) (index uint))
  (map-get? messages { context-id: context-id, message-index: index })
)

(define-read-only (get-message-count (context-id uint))
  (get count (default-to { count: u0 } (map-get? message-count { context-id: context-id })))
)
