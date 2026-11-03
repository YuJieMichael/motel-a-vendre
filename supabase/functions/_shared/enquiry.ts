import { isEnquiryDateInRange } from './platform-date.ts';

export type Enquiry = Record<string, string> & { requestId: string; kind: string; name: string; email: string; language: string };
export function parseEnquiry(value: unknown, now = new Date()): Enquiry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('invalid');
  const input = value as Record<string, unknown>;
  const limits: Record<string, number> = {requestId:36,kind:6,language:2,name:120,email:254,phone:40,city:200,address:300,listingReference:36,propertyType:20,daycareSubsidy:20,budgetMin:10,budgetMax:10,expectedPrice:10,timeline:200,service:6,assistance:100,contactLanguage:2,contactMethod:5,contactTime:200,requirements:3000,website:200};
  const result: Record<string,string> = {};
  for (const [key,max] of Object.entries(limits)) {
    const v = input[key] ?? '';
    if (typeof v !== 'string' || v.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)) throw Error('invalid');
    result[key] = v.trim();
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.requestId) || !['buyer','seller'].includes(result.kind) || !['en','fr','zh'].includes(result.language)) throw Error('invalid');
  if (!result.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email) || result.website) throw Error('invalid');
  for (const key of ['budgetMin','budgetMax','expectedPrice']) if (result[key] && (!/^\d+$/.test(result[key]) || Number(result[key]) > 1000000000)) throw Error('invalid');
  if (result.timeline && !isEnquiryDateInRange(result.timeline, now)) throw Error('invalid');
  if (result.budgetMin && result.budgetMax && Number(result.budgetMin)>Number(result.budgetMax)) throw Error('invalid');
  // Public listing numbers and older UUID links both identify property enquiries.
  if (result.listingReference && !/^(?:[0-9]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(result.listingReference)) throw Error('invalid');
  if (!['','house','condo','plex','commercial','land','hotel-motel','daycare','business'].includes(result.propertyType) || !['','hybrid','broker'].includes(result.service)) throw Error('invalid');
  if (!['','subsidized','non-subsidized'].includes(result.daycareSubsidy) || (result.propertyType === 'daycare' ? !result.daycareSubsidy : !!result.daycareSubsidy)) throw Error('invalid');
  if (result.kind === 'buyer') { result.address=''; result.expectedPrice=''; result.service=''; }
  else { if (!['broker','hybrid'].includes(result.service)) throw Error('invalid'); result.budgetMin=''; result.budgetMax=''; }
  if (!['','en','fr','zh'].includes(result.contactLanguage) || !['','email','phone'].includes(result.contactMethod)) throw Error('invalid');
  const requested = result.assistance ? result.assistance.split(',') : [];
  const allowed = ['photos','video','listing','pricing','visits','offers','unsure'];
  if (requested.some(id => !allowed.includes(id)) || new Set(requested).size !== requested.length || (requested.includes('unsure') && requested.length > 1)) throw Error('invalid');
  result.assistance = result.kind === 'seller' && result.service === 'hybrid' ? allowed.filter(id => requested.includes(id)).join(',') : '';
  delete result.website;
  return result as Enquiry;
}

export function enquiriesCsv(rows: Record<string, unknown>[]): string {
  const columns = ['created_at','kind','name','email','phone','city','address','propertyType','daycareSubsidy','budgetMin','budgetMax','expectedPrice','requirements','timeline','service','assistance','contactLanguage','contactMethod','contactTime','listingReference','language'];
  const cell = (v: unknown) => {
    let text = String(v ?? '');
    if (/^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"','""') + '"';
  };
  return '\uFEFF' + [columns, ...rows.map(row => columns.map(key => row[key]))].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
