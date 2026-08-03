import "server-only";
import { createDAVClient } from "tsdav";

/**
 * iCloud CalDAV 클라이언트 (SPEC.md 5.1).
 *
 * 절대 규칙 4: 모든 CalDAV 호출은 서버에서만. 브라우저에서 부르면 CORS로 막히고
 * 앱 전용 암호가 노출된다. `server-only` import가 이걸 빌드 시점에 강제한다.
 */

const SERVER_URL = "https://caldav.icloud.com";

export type DAVClient = Awaited<ReturnType<typeof createDAVClient>>;

export function appCalendarName(): string {
  return process.env.APP_CALENDAR_NAME ?? "Personal OS";
}

export async function createCalDavClient(): Promise<DAVClient> {
  const username = process.env.APPLE_ID;
  const rawPassword = process.env.APPLE_APP_PASSWORD;

  if (!username) throw new Error("환경변수 APPLE_ID 없음");
  if (!rawPassword) throw new Error("환경변수 APPLE_APP_PASSWORD 없음");

  return createDAVClient({
    serverUrl: SERVER_URL,
    // 앱 전용 암호는 발급 시 하이픈이 붙어 나온다. 붙여 넣은 그대로 받아준다.
    credentials: { username, password: rawPassword.replace(/[\s-]/g, "") },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });
}
