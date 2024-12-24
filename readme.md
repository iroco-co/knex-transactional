# Transaction Management with Node.js

Knex ORM with Transactional decorator

## 성능 테스트 결과

### 테스트 환경

- 테스트 도구: Artillery
- 부하 설정:
  - 워밍업: 5초 동안 초당 10개 요청
  - 피크 부하: 120초 동안 초당 100개 요청

### API 응답 시간 비교

#### 데코레이터 방식 (`/decorator`)

```typescript
@Transactional()
async insertUserHistoryTransaction(userId: number) {
    const result = await db("user_history3")
    .insert({
        userId,
        target: "userId",
        before: String(userId),
        after: String(userId),
    })
    .returning("\*");

    await db("user_history3")
      .update({
        userId,
        target: "userId",
        before: String(userId),
        after: String(userId),
      })
      .where("id", result[0].id);

}
```

| 지표   | 응답시간 (ms) |
| ------ | ------------- |
| 최소   | 2ms           |
| 중간값 | 6ms           |
| 평균   | 11.6ms        |
| p90    | 18ms          |
| p95    | 40.9ms        |
| p99    | 98.5ms        |
| 최대   | 355ms         |

#### 수동 트랜잭션 방식 (`/manual`)

```typescript
async insertUserHistoryManually(userId: number) {
const trx = await db.transaction();

    const result = await trx("user_history2")
      .insert({
        userId,
        target: "userId",
        before: String(userId),
        after: String(userId),
      })
      .returning("*");

    await trx("user_history2")
      .update({
        userId,
        target: "userId",
        before: String(userId),
        after: String(userId),
      })
      .where("id", result[0].id);

    await trx.commit();

}
```

| 지표   | 응답시간 (ms) |
| ------ | ------------- |
| 최소   | 2ms           |
| 중간값 | 7ms           |
| 평균   | 11.8ms        |
| p90    | 18ms          |
| p95    | 40ms          |
| p99    | 115.6ms       |
| 최대   | 356ms         |

### 주요 지표

- 총 요청 수: 12,050
- 성공률: 100% (에러 없음)
- 초당 평균 요청: 100개
- 평균 세션 길이: 18.2ms

### 결론

1. 일반적인 상황(p50-p90)에서는 두 방식의 성능 차이가 미미함 (1ms 이내)
2. 고부하 상황(p95-p99)에서는 데코레이터 방식이 약간 더 안정적인 성능을 보임
3. 두 방식 모두 안정적으로 동작하며 실제 프로덕션 환경에서 사용하기에 적합함

> 참고: p95는 상위 95% 요청의 응답시간을 의미합니다. 즉, 95%의 요청이 해당 시간 이내에 처리되었다는 뜻입니다.

graph LR
A[최소 2ms] --> B[중간값 6-7ms] --> C[p90 18ms] --> D[p95 40ms] --> E[p99 100-115ms] --> F[최대 355ms]

graph TD
subgraph 데코레이터
D1[최소 2ms]
D2[중간값 6ms]
D3[p90 18ms]
D4[p95 40.9ms]
D5[p99 98.5ms]
end

    subgraph 수동방식
    M1[최소 2ms]
    M2[중간값 7ms]
    M3[p90 18ms]
    M4[p95 40ms]
    M5[p99 115.6ms]
    end

journey
title 응답시간 분포 비교
section 데코레이터
최소: 2: 2
중간값: 6: 3
p90: 18: 4
p95: 40.9: 5
p99: 98.5: 6
section 수동방식
최소: 2: 2
중간값: 7: 3
p90: 18: 4
p95: 40: 5
p99: 115.6: 6

### 상세 비교

| 지표   | 데코레이터 | 수동방식 | 차이    |
| ------ | ---------- | -------- | ------- |
| 최소   | 2ms        | 2ms      | 0ms     |
| 중간값 | 6ms        | 7ms      | -1ms    |
| p90    | 18ms       | 18ms     | 0ms     |
| p95    | 40.9ms     | 40ms     | +0.9ms  |
| p99    | 98.5ms     | 115.6ms  | -17.1ms |

````

```

```
````
