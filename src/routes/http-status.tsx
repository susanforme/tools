import { createFileRoute } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../components/ui/badge';

export const Route = createFileRoute('/http-status')({
  component: HttpStatusPage,
});

type StatusCode = {
  code: number;
  name: string;
  desc: string;
  descEn: string;
};

const STATUS_CODES: StatusCode[] = [
  // 1xx
  { code: 100, name: 'Continue', desc: '服务器已收到请求头，客户端应继续发送请求体', descEn: 'Server received request headers; client should proceed to send the request body.' },
  { code: 101, name: 'Switching Protocols', desc: '服务器同意客户端升级协议（如 HTTP → WebSocket）', descEn: 'Server agrees to switch to the protocol requested by the client (e.g. HTTP → WebSocket).' },
  { code: 102, name: 'Processing', desc: '服务器正在处理请求，尚未完成（WebDAV）', descEn: 'Server has received the request and is still processing it (WebDAV).' },
  { code: 103, name: 'Early Hints', desc: '允许客户端在最终响应前开始预加载资源', descEn: 'Allows the client to start preloading resources while the server prepares the final response.' },
  // 2xx
  { code: 200, name: 'OK', desc: '请求成功，响应体包含请求结果', descEn: 'Request succeeded. The response body contains the result.' },
  { code: 201, name: 'Created', desc: '请求已成功，并创建了新资源（常用于 POST）', descEn: 'Request succeeded and a new resource was created (commonly used with POST).' },
  { code: 202, name: 'Accepted', desc: '请求已接受，但尚未处理完成（异步操作）', descEn: 'Request accepted for processing, but processing has not been completed (async).' },
  { code: 203, name: 'Non-Authoritative Information', desc: '响应来自缓存或第三方副本，不是原始服务器', descEn: 'Response is from a cache or third-party copy, not the origin server.' },
  { code: 204, name: 'No Content', desc: '请求成功，响应不含主体（常用于 DELETE / PUT）', descEn: 'Request succeeded. No body is returned (common for DELETE / PUT).' },
  { code: 205, name: 'Reset Content', desc: '请求成功，要求客户端重置文档视图', descEn: 'Request succeeded. Client should reset the document view.' },
  { code: 206, name: 'Partial Content', desc: '服务器成功处理了部分 GET 请求（Range 请求）', descEn: 'Server fulfilled a partial GET request (Range request).' },
  { code: 207, name: 'Multi-Status', desc: '多状态响应，包含多个子操作的状态（WebDAV）', descEn: 'Multi-status response containing multiple independent operation statuses (WebDAV).' },
  { code: 208, name: 'Already Reported', desc: '已在之前的响应中汇报（WebDAV）', descEn: 'Members already reported in previous response (WebDAV).' },
  { code: 226, name: 'IM Used', desc: '使用了实例操作（Delta encoding）', descEn: 'Delta encoding in use; server fulfilled a GET using instance manipulations.' },
  // 3xx
  { code: 300, name: 'Multiple Choices', desc: '请求有多个可能响应，需用户选择', descEn: 'Multiple potential responses exist; user must choose one.' },
  { code: 301, name: 'Moved Permanently', desc: '资源已永久移动到新 URL，应更新书签', descEn: 'Resource permanently moved to a new URL. Update bookmarks.' },
  { code: 302, name: 'Found', desc: '资源临时移动，客户端应继续使用原 URL', descEn: 'Resource temporarily moved; client should continue using the original URL.' },
  { code: 303, name: 'See Other', desc: '要求客户端用 GET 访问另一个 URL（重定向）', descEn: 'Client should GET a different URL (usually after a POST redirect).' },
  { code: 304, name: 'Not Modified', desc: '资源未修改，客户端可使用缓存版本', descEn: 'Resource unchanged since last request. Client can use cached version.' },
  { code: 305, name: 'Use Proxy', desc: '必须通过代理访问（已弃用）', descEn: 'Resource must be accessed through a proxy. (Deprecated)' },
  { code: 307, name: 'Temporary Redirect', desc: '资源临时移动，请求方式不变（与 302 类似但更严格）', descEn: 'Temporary redirect; method and body must not change (stricter than 302).' },
  { code: 308, name: 'Permanent Redirect', desc: '资源永久移动，请求方式不变（与 301 类似但更严格）', descEn: 'Permanent redirect; method and body must not change (stricter than 301).' },
  // 4xx
  { code: 400, name: 'Bad Request', desc: '服务器无法理解客户端发送的请求（格式错误等）', descEn: 'Server cannot process the request due to client error (e.g. malformed syntax).' },
  { code: 401, name: 'Unauthorized', desc: '需要身份认证，请求头缺少或包含无效的认证信息', descEn: 'Authentication required. Missing or invalid credentials in request.' },
  { code: 402, name: 'Payment Required', desc: '预留状态码，表示需要付费（未广泛使用）', descEn: 'Reserved for future use; indicates payment is required (rarely used).' },
  { code: 403, name: 'Forbidden', desc: '服务器理解请求，但拒绝执行（无权限）', descEn: 'Server understood the request but refuses to authorize it.' },
  { code: 404, name: 'Not Found', desc: '请求的资源不存在于服务器上', descEn: 'The requested resource could not be found on the server.' },
  { code: 405, name: 'Method Not Allowed', desc: '请求方式不被目标资源允许', descEn: 'The HTTP method is not supported for the target resource.' },
  { code: 406, name: 'Not Acceptable', desc: '服务器无法生成客户端 Accept 头接受的内容', descEn: 'Server cannot produce a response matching the criteria in the Accept headers.' },
  { code: 407, name: 'Proxy Authentication Required', desc: '需要代理身份认证', descEn: 'Proxy authentication is required before the request can be fulfilled.' },
  { code: 408, name: 'Request Timeout', desc: '客户端未在规定时间内发送完整请求', descEn: 'Client did not send a complete request within the server\'s timeout period.' },
  { code: 409, name: 'Conflict', desc: '请求与目标资源的当前状态冲突', descEn: 'Request conflicts with the current state of the target resource.' },
  { code: 410, name: 'Gone', desc: '请求的资源已永久删除，不再可用', descEn: 'The resource has been permanently removed and is no longer available.' },
  { code: 411, name: 'Length Required', desc: '请求需要 Content-Length 头', descEn: 'Server requires a Content-Length header in the request.' },
  { code: 412, name: 'Precondition Failed', desc: '请求头中的前提条件（If-Match 等）失败', descEn: 'Precondition headers (e.g. If-Match) evaluated to false on the server.' },
  { code: 413, name: 'Content Too Large', desc: '请求体超过服务器限制大小', descEn: 'Request body exceeds the server\'s maximum allowed size.' },
  { code: 414, name: 'URI Too Long', desc: '请求 URL 超过服务器接受的最大长度', descEn: 'The request URL is longer than the server is willing to accept.' },
  { code: 415, name: 'Unsupported Media Type', desc: '服务器不支持请求的媒体类型', descEn: 'The media type of the request body is not supported by the server.' },
  { code: 416, name: 'Range Not Satisfiable', desc: 'Range 头指定的范围无效', descEn: 'The Range header field specifies a range that cannot be satisfied.' },
  { code: 417, name: 'Expectation Failed', desc: 'Expect 请求头无法被满足', descEn: 'The expectation in the Expect request header cannot be met by the server.' },
  { code: 418, name: "I'm a Teapot", desc: '我是茶壶，拒绝冲咖啡（RFC 2324 愚人节 RFC）', descEn: "I'm a teapot; refuses to brew coffee. (April Fools' RFC 2324)" },
  { code: 421, name: 'Misdirected Request', desc: '请求被发送到无法生成响应的服务器', descEn: 'Request was directed at a server unable to produce a response.' },
  { code: 422, name: 'Unprocessable Content', desc: '请求格式正确，但语义错误（如 JSON 验证失败）', descEn: 'Request is well-formed but contains semantic errors (e.g. JSON validation failure).' },
  { code: 423, name: 'Locked', desc: '资源已锁定（WebDAV）', descEn: 'The resource is locked (WebDAV).' },
  { code: 424, name: 'Failed Dependency', desc: '前置操作失败导致当前请求失败（WebDAV）', descEn: 'Request failed because a preceding request failed (WebDAV).' },
  { code: 425, name: 'Too Early', desc: '服务器拒绝处理过早发送的请求（防重放攻击）', descEn: 'Server refuses to risk processing a request that might be replayed.' },
  { code: 426, name: 'Upgrade Required', desc: '需要升级协议（如 TLS）', descEn: 'Client must switch to a different protocol (e.g. TLS).' },
  { code: 428, name: 'Precondition Required', desc: '服务器要求请求附带前提条件头', descEn: 'Server requires the request to include conditional headers.' },
  { code: 429, name: 'Too Many Requests', desc: '请求频率过高，触发速率限制（限流）', descEn: 'Client has sent too many requests in a given time (rate limiting).' },
  { code: 431, name: 'Request Header Fields Too Large', desc: '请求头字段过大', descEn: 'Request headers are too large for the server to process.' },
  { code: 451, name: 'Unavailable For Legal Reasons', desc: '因法律原因资源不可访问', descEn: 'Resource is unavailable due to legal demands (e.g. censorship).' },
  // 5xx
  { code: 500, name: 'Internal Server Error', desc: '服务器遇到意外情况，无法完成请求', descEn: 'Server encountered an unexpected condition that prevented the request from being fulfilled.' },
  { code: 501, name: 'Not Implemented', desc: '服务器不支持当前请求方式', descEn: 'Server does not support the HTTP method used in the request.' },
  { code: 502, name: 'Bad Gateway', desc: '网关或代理服务器收到无效响应', descEn: 'Gateway or proxy server received an invalid response from the upstream server.' },
  { code: 503, name: 'Service Unavailable', desc: '服务器暂时无法处理请求（过载或维护）', descEn: 'Server temporarily unavailable due to overload or scheduled maintenance.' },
  { code: 504, name: 'Gateway Timeout', desc: '网关等待上游服务器响应超时', descEn: 'Gateway did not receive a timely response from the upstream server.' },
  { code: 505, name: 'HTTP Version Not Supported', desc: '服务器不支持请求使用的 HTTP 版本', descEn: 'Server does not support the HTTP protocol version used in the request.' },
  { code: 506, name: 'Variant Also Negotiates', desc: '服务器配置错误导致内容协商循环', descEn: 'Server misconfiguration: chosen variant is itself engaged in content negotiation.' },
  { code: 507, name: 'Insufficient Storage', desc: '服务器存储空间不足（WebDAV）', descEn: 'Server cannot store the representation needed to complete the request (WebDAV).' },
  { code: 508, name: 'Loop Detected', desc: '检测到无限循环（WebDAV）', descEn: 'Infinite loop detected while processing the request (WebDAV).' },
  { code: 510, name: 'Not Extended', desc: '服务器需要对请求进行扩展', descEn: 'Further extensions to the request are required for the server to fulfill it.' },
  { code: 511, name: 'Network Authentication Required', desc: '需要网络认证（如强制门户）', descEn: 'Client must authenticate to gain network access (e.g. captive portal).' },
];

function getCategory(code: number) {
  if (code < 200) return '1xx';
  if (code < 300) return '2xx';
  if (code < 400) return '3xx';
  if (code < 500) return '4xx';
  return '5xx';
}

function categoryColor(cat: string) {
  switch (cat) {
    case '1xx':
      return 'text-sky-600 bg-sky-500/10 border-sky-500/30';
    case '2xx':
      return 'text-green-600 bg-green-500/10 border-green-500/30';
    case '3xx':
      return 'text-yellow-600 bg-yellow-500/10 border-yellow-500/30';
    case '4xx':
      return 'text-orange-600 bg-orange-500/10 border-orange-500/30';
    default:
      return 'text-red-600 bg-red-500/10 border-red-500/30';
  }
}

function HttpStatusPage() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');

  function categoryLabel(cat: string) {
    const map: Record<string, string> = {
      '1xx': t('httpStatus.cat1xx'),
      '2xx': t('httpStatus.cat2xx'),
      '3xx': t('httpStatus.cat3xx'),
      '4xx': t('httpStatus.cat4xx'),
      '5xx': t('httpStatus.cat5xx'),
    };
    return map[cat] ?? cat;
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return STATUS_CODES.filter((s) => {
      if (catFilter !== 'all' && getCategory(s.code) !== catFilter)
        return false;
      if (!q) return true;
      return (
        String(s.code).includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.desc.includes(q) ||
        s.descEn.toLowerCase().includes(q)
      );
    });
  }, [search, catFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, StatusCode[]>();
    filtered.forEach((s) => {
      const cat = getCategory(s.code);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    });
    return map;
  }, [filtered]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t('httpStatus.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('httpStatus.desc')}
        </p>
      </div>

      {/* Search & filter */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('httpStatus.searchPlaceholder')}
            className="w-full h-9 pl-8 pr-3 text-sm rounded border bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['all', '1xx', '2xx', '3xx', '4xx', '5xx'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCatFilter(cat)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                catFilter === cat
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat === 'all' ? t('httpStatus.all') : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="space-y-5">
        {Array.from(grouped.entries()).map(([cat, items]) => (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-3">
              <Badge
                variant="outline"
                className={`text-xs font-mono ${categoryColor(cat)}`}
              >
                {categoryLabel(cat)}
              </Badge>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="divide-y border rounded-lg overflow-hidden">
              {items.map((s) => (
                <div
                  key={s.code}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <span
                    className={`font-mono font-bold text-sm shrink-0 ${
                      categoryColor(
                        s.code < 200
                          ? '1xx'
                          : s.code < 300
                            ? '2xx'
                            : s.code < 400
                              ? '3xx'
                              : s.code < 500
                                ? '4xx'
                                : '5xx',
                      ).split(' ')[0]
                    }`}
                  >
                    {s.code}
                  </span>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {isZh ? s.desc : s.descEn}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            {t('httpStatus.noMatch')}
          </p>
        )}
      </div>
    </div>
  );
}
