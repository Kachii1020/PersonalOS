import type { IbEngDomainMeta, IbEngLesson } from "./types";
import type { QuizDomain } from "@/lib/ai/prompts/quiz";

export const IB_ENG_DOMAINS: IbEngDomainMeta[] = [
  {
    id: "ib_eng_markets",
    title: "시장 배관",
    blurb: "주문이 어떻게 나가고 체결이 어떻게 돌아오는지. FIX·OMS·시세.",
  },
  {
    id: "ib_eng_latency",
    title: "저지연",
    blurb: "핫패스에서 멈추는 것. GC, 캐시, 시계, 시스템콜.",
  },
  {
    id: "ib_eng_concurrency",
    title: "동시성",
    blurb: "같은 장부를 여러 스레드가 만질 때. 가시성과 단일 작성자.",
  },
  {
    id: "ib_eng_data",
    title: "포지션 데이터",
    blurb: "체결을 한 번만 세고, 창함수로 집계하고, 대사로 깨진 것을 찾는다.",
  },
  {
    id: "ib_eng_systems",
    title: "거래 시스템",
    blurb: "죽어도 중복 체결이 안 되고, 막아야 할 때 전체가 선다.",
  },
  {
    id: "ib_eng_ds",
    title: "면접 자료구조",
    blurb: "호가창·VWAP·중앙값. 은행 맥락의 알고리즘.",
  },
];

export const IB_ENG_LESSONS: IbEngLesson[] = [
  {
    domain: "ib_eng_markets",
    title: "주문의 길: FIX에서 체결까지",
    content:
      "IB 테크의 첫 층은 화면이 아니라 세션이다. OMS는 주문의 생애(접수·라우팅·상태)를 소유하고, EMS는 어디로 보낼지(스마트 오더 라우팅, 알고리즘)를 고른다. 둘을 한 프로세스에 넣으면 책임이 섞여 장애 때 어느 장부가 맞는지 모른다. 와이어는 대개 FIX다. MsgType(35)이 메시지 종류이고, ClOrdID(11)는 우리 쪽 주문 키, ExecID(17)는 체결 키다. 같은 체결을 두 번 적용하면 포지션이 틀린다. 주문 유형(Limit/Market/IOC/FOK)과 TIF는 매칭 엔진의 규칙이지 UI 라벨이 아니다. 시세는 스냅샷과 증분이 다르고, 시퀀스 갭을 무시하면 호가가 조용히 틀린다.",
    keyTerms: [
      "FIX",
      "MsgType(35)",
      "ClOrdID",
      "ExecID",
      "OrdStatus",
      "OMS",
      "EMS",
      "IOC",
      "FOK",
      "drop copy",
      "price-time",
      "gap fill",
    ],
  },
  {
    domain: "ib_eng_latency",
    title: "평균이 아니라 꼬리가 상품이다",
    content:
      "마켓즈에서 느린 한 건이 기회를 죽인다. 평균 지연이 아니라 p99/p999와 jitter를 본다. 핫패스에서 힙 할당을 하면 GC가 예측 못 하는 정지를 만든다. 캐시 라인(보통 64B)을 두 스레드가 쓰면 false sharing으로 혼자 쓸 때보다 느려진다. 대기열에서 park하면 깨어나는 비용이 생기고, 바쁜 루프는 CPU를 태운다. 시계는 NTP로 맞춘 wall clock과 TSC 기반 단조 시계를 섞어 쓰면 구간 측정이 거짓말이 된다. 시스템콜·로그·예외를 핫패스에 두면 벤치마크와 장이 갈린다.",
    keyTerms: [
      "tail latency",
      "p99",
      "GC pause",
      "false sharing",
      "cache line",
      "busy-spin",
      "TSC",
      "kernel bypass",
      "allocation",
      "jitter",
      "huge pages",
      "mechanical sympathy",
    ],
  },
  {
    domain: "ib_eng_concurrency",
    title: "잠금보다 소유권을 먼저 나눈다",
    content:
      "체결 스레드가 같은 호가창을 잠그고 기다리면 지연이 잠금 시간이 된다. Java Memory Model에서 한 스레드의 쓰기가 다른 스레드에 보이려면 happens-before가 필요하다. volatile은 가시성과 단일 변수의 원자성이지 복합 불변식의 보호가 아니다. CAS는 락 없이 갱신하지만 ABA에 속는다. 거래 경로에서 자주 쓰는 답은 단일 작성자(single-writer)다. 큐에 넣고 한 스레드만 장부를 바꾼다. Disruptor 같은 링 버퍼는 그 패턴의 구현이다. 공유 가변 상태를 줄이는 쪽이 synchronized를 잘 쓰는 쪽보다 면접에서 더 깊게 보인다.",
    keyTerms: [
      "happens-before",
      "volatile",
      "synchronized",
      "CAS",
      "ABA",
      "single-writer",
      "Disruptor",
      "deadlock",
      "livelock",
      "publication",
      "immutable",
      "false sharing",
    ],
  },
  {
    domain: "ib_eng_data",
    title: "체결은 사건이고 포지션은 합이다",
    content:
      "주문·체결·포지션을 한 행에 덮어쓰면 대사가 불가능하다. ExecID unique로 체결을 한 번만 넣고, 포지션은 부호 있는 수량의 합이다. 같은 체결이 드롭카피로 두 번 오면 insert가 거절되어야 한다. 격리 수준을 낮추면 아직 확정되지 않은 체결을 리스크가 읽고, 높이면 장이 기다린다. VWAP은 가격×수량 합 / 수량 합이고 창함수로 구간을 자른다. EOD 스냅샷은 as-of다. 시계가 두 개면 같은 사건이 다른 날에 들어간다. 대사는 우리 장부와 거래소·브로커 장부의 차이다. 차이를 수동으로 고치면 다음 날 또 틀린다.",
    keyTerms: [
      "ExecID",
      "idempotent insert",
      "READ COMMITTED",
      "SERIALIZABLE",
      "lost update",
      "VWAP",
      "window function",
      "as-of",
      "reconcile",
      "drop copy",
      "signed quantity",
      "event log",
    ],
  },
  {
    domain: "ib_eng_systems",
    title: "막아야 할 때 전체가 서야 한다",
    content:
      "거래 시스템은 처리량보다 잘못 체결하지 않는 쪽이 먼저다. kill switch는 신규 주문을 멈추고, 이미 나간 주문을 어떻게 할지는 별 규칙이다. 네트워크는 at-least-once가 기본이다. exactly-once는 전송 마법이 아니라 수신 쪽 멱등(ExecID, 시퀀스)이다. 저널에 쓰고 재생할 수 있어야 프로세스가 죽어도 장부가 맞다. 주문 테이블과 체결 테이블을 따로 커밋하면 한쪽만 남는 이중 쓰기가 난다. 리스크는 전송 전 검사와 전송 후 검사가 다르고, 한도 경쟁은 한 스레드나 원자적 예약으로 막는다. 대사가 소스 오브 트루스다.",
    keyTerms: [
      "kill switch",
      "at-least-once",
      "idempotent consumer",
      "journal",
      "replay",
      "dual write",
      "backpressure",
      "pre-trade risk",
      "post-trade risk",
      "poison message",
      "sequence gap",
      "warm standby",
    ],
  },
  {
    domain: "ib_eng_ds",
    title: "호가창은 정렬된 두 쪽이다",
    content:
      "매수는 높은 가격이 앞이고 매도는 낮은 가격이 앞이다. 같은 가격은 먼저 들어온 수량이 먼저 나간다(price-time). 구현은 가격 레벨을 트리/힙으로, 레벨 안은 큐로 두는 식이 흔하다. VWAP은 구간 합이지 종가의 평균이 아니다. 중앙값 마크는 두 힙(낮은 쪽 max-heap, 높은 쪽 min-heap)으로 스트리밍할 수 있다. 슬라이딩 윈도우 거래량은 deque로 만료를 뺀다. 중복 체결은 ExecID 집합이다. 스탑 주문을 감시하는 쪽은 트리거 가격 우선순위 큐다. 면접에서 일반 두 합(two-sum)을 내기보다 이 장부 이야기로 자료구조를 설명하면 IB 맥락이 맞다.",
    keyTerms: [
      "order book",
      "price-time priority",
      "bid/ask",
      "VWAP",
      "two heaps",
      "sliding window",
      "deque",
      "hash set",
      "priority queue",
      "binary search",
      "prefix sum",
      "FIFO level",
    ],
  },
];

export function lessonFor(domain: QuizDomain): IbEngLesson | undefined {
  return IB_ENG_LESSONS.find((row) => row.domain === domain);
}
