#include <math.h>
#include <sys/time.h>
#include "time.h"
#include "ts_lang.h"
#include "ts_std_timer_internal.h"

typedef struct _ts_std_date_t {
  ts_object_t base;
} ts_std_date_t;

// copied from quickjs

static int64_t math_mod(int64_t a, int64_t b) {
  /* return positive modulo */
  int64_t m = a % b;
  return m + (m < 0) * b;
}

static int64_t floor_div(int64_t a, int64_t b) {
  /* integer division rounding toward -Infinity */
  int64_t m = a % b;
  return (a - (m + (m < 0) * b)) / b;
}

static int64_t days_from_year(int64_t y) {
  return 365 * (y - 1970) + floor_div(y - 1969, 4) - floor_div(y - 1901, 100) +
         floor_div(y - 1601, 400);
}

static int64_t days_in_year(int64_t y) {
  return 365 + !(y % 4) - !(y % 100) + !(y % 400);
}

/* return the year, update days */
static int64_t year_from_days(int64_t* days) {
  int64_t y, d1, nd, d = *days;
  y = floor_div(d * 10000, 3652425) + 1970;
  /* the initial approximation is very good, so only a few
     iterations are necessary */
  for (;;) {
    d1 = d - days_from_year(y);
    if (d1 < 0) {
      y--;
      d1 += days_in_year(y);
    } else {
      nd = days_in_year(y);
      if (d1 < nd)
        break;
      d1 -= nd;
      y++;
    }
  }
  *days = d1;
  return y;
}

static int getTimezoneOffset(int64_t time) {
#if defined(_WIN32)
  /* XXX: TODO */
  return 0;
#else
  time_t ti;
  struct tm tm;

  time /= 1000; /* convert to seconds */
  if (sizeof(time_t) == 4) {
    /* on 32-bit systems, we need to clamp the time value to the
       range of `time_t`. This is better than truncating values to
       32 bits and hopefully provides the same result as 64-bit
       implementation of localtime_r.
     */
    if ((time_t)-1 < 0) {
      if (time < INT32_MIN) {
        time = INT32_MIN;
      } else if (time > INT32_MAX) {
        time = INT32_MAX;
      }
    } else {
      if (time < 0) {
        time = 0;
      } else if (time > UINT32_MAX) {
        time = UINT32_MAX;
      }
    }
  }
  ti = time;
  localtime_r(&ti, &tm);
  return -tm.tm_gmtoff / 60;
#endif
}

static int const month_days[] = {31, 28, 31, 30, 31, 30,
                                 31, 31, 30, 31, 30, 31};
static char const month_names[] = "JanFebMarAprMayJunJulAugSepOctNovDec";
static char const day_names[] = "SunMonTueWedThuFriSat";

static int _ts_date_get_fields(ts_object_t* self,
                               ts_argument_t args,
                               ts_return_t ret,
                               double fields[9],
                               int is_local,
                               int force) {
  double dval;
  int64_t d, days, wd, y, i, md, h, m, s, ms, tz = 0;
  dval = *TS_OBJECT_MEMBER_OF(double, self, 0);
  if (isnan(dval)) {
    if (!force) {
      return -1;  // false
    }
    d = 0;
  } else {
    d = dval;
    if (is_local) {
      tz = -getTimezoneOffset(d);
      d += tz * 60000;
    }
  }

  /* result is >= 0, we can use % */
  h = math_mod(d, 86400000);
  days = (d - h) / 86400000;
  ms = h % 1000;
  h = (h - ms) / 1000;
  s = h % 60;
  h = (h - s) / 60;
  m = h % 60;
  h = (h - m) / 60;
  wd = math_mod(days + 4, 7); /* week day */
  y = year_from_days(&days);

  for (i = 0; i < 11; i++) {
    md = month_days[i];
    if (i == 1)
      md += days_in_year(y) - 365;
    if (days < md)
      break;
    days -= md;
  }
  fields[0] = y;
  fields[1] = i;
  fields[2] = days + 1;
  fields[3] = h;
  fields[4] = m;
  fields[5] = s;
  fields[6] = ms;
  fields[7] = wd;
  fields[8] = tz;
  return 1;
}

static int _ts_date_get_field(ts_object_t* self,
                              ts_argument_t args,
                              ts_return_t ret,
                              int magic) {
  double fields[9];
  int res, n, is_local;

  is_local = magic & 0x0F;
  n = (magic >> 4) & 0x0F;
  res = _ts_date_get_fields(self, args, ret, fields, is_local, 0);
  //  if (res < 0)
  //    return JS_EXCEPTION;
  //  if (!res)
  //    return JS_NAN;

  if (magic & 0x100) {  // getYear
    fields[0] -= 1900;
  }

  TS_RETURN_FLOAT(ret, fields[n]);
  return 0;
}

static double time_clip(double t) {
  if (t >= -8.64e15 && t <= 8.64e15)
    return trunc(t) + 0.0; /* convert -0 to +0 */
  else
    return NAN;
}

/* The spec mandates the use of 'double' and it fixes the order
   of the operations */
static double set_date_fields(double fields[], int is_local) {
  int64_t y;
  double days, d, h, m1;
  int i, m, md;

  m1 = fields[1];
  m = fmod(m1, 12);
  if (m < 0)
    m += 12;
  y = (int64_t)(fields[0] + floor(m1 / 12));
  days = days_from_year(y);

  for (i = 0; i < m; i++) {
    md = month_days[i];
    if (i == 1)
      md += days_in_year(y) - 365;
    days += md;
  }
  days += fields[2] - 1;
  h = fields[3] * 3600000 + fields[4] * 60000 + fields[5] * 1000 + fields[6];
  d = days * 86400000 + h;
  if (is_local)
    d += getTimezoneOffset(d) * 60000;
  return time_clip(d);
}

static int64_t date_now(void) {
  struct timeval tv;
  gettimeofday(&tv, NULL);
  return (int64_t)tv.tv_sec * 1000 + (tv.tv_usec / 1000);
}

static double set_date_field(ts_object_t* obj,
                             ts_argument_t args,
                             ts_return_t ret,
                             int magic) {
  int64_t argc = args != NULL ? TS_ARG_COUNT(args) : 0;
  // _field(obj, first_field, end_field, args, is_local)
  double fields[9];
  int res, first_field, end_field, is_local, i, n;
  double d, a;

  d = NAN;
  first_field = (magic >> 8) & 0x0F;
  end_field = (magic >> 4) & 0x0F;
  is_local = magic & 0x0F;

  res = _ts_date_get_fields(obj, args, ret, fields, is_local, first_field == 0);
  //  if (res < 0)
  //    return JS_EXCEPTION;
  if (res && argc > 0) {
    n = end_field - first_field;
    if (argc < n)
      n = argc;
    for (i = 0; i < n; i++) {
      a = TS_ARG_DOUBLE(args, i);
      //      if (JS_ToFloat64(ctx, &a, argv[i]))
      //        return JS_EXCEPTION;
      if (!isfinite(a))
        goto done;
      fields[first_field + i] = trunc(a);
    }
    d = set_date_fields(fields, is_local);
  }
done:
  return d;
  //   return JS_SetThisTimeValue(ctx, this_val, d);
}

/* fmt:
   0: toUTCString: "Tue, 02 Jan 2018 23:04:46 GMT"
   1: toString: "Wed Jan 03 2018 00:05:22 GMT+0100 (CET)"
   2: toISOString: "2018-01-02T23:02:56.927Z"
   3: toLocaleString: "1/2/2018, 11:40:40 PM"
   part: 1=date, 2=time 3=all
   XXX: should use a variant of strftime().
 */
static int get_date_string(ts_object_t* obj,
                           ts_argument_t args,
                           ts_return_t ret,
                           int magic) {
  // _string(obj, fmt, part)
  char buf[64];
  double fields[9];
  int res, fmt, part, pos;
  int y, mon, d, h, m, s, ms, wd, tz;

  fmt = (magic >> 4) & 0x0F;
  part = magic & 0x0F;

  res = _ts_date_get_fields(obj, args, ret, fields, fmt & 1, 0);
  if (res < 0) {
    //    return JS_EXCEPTION;
  }
  if (!res) {
    if (fmt == 2) {
      //      return JS_ThrowRangeError(ctx, "Date value is NaN");
    } else {
      TS_RETURN_STR(ret, "Invalid Date");
      //      return JS_NewString(ctx, "Invalid Date");
    }
  }

  y = fields[0];
  mon = fields[1];
  d = fields[2];
  h = fields[3];
  m = fields[4];
  s = fields[5];
  ms = fields[6];
  wd = fields[7];
  tz = fields[8];

  pos = 0;

  if (part & 1) { /* date part */
    switch (fmt) {
      case 0:
        pos += snprintf(buf + pos, sizeof(buf) - pos, "%.3s, %02d %.3s %0*d ",
                        day_names + wd * 3, d, month_names + mon * 3,
                        4 + (y < 0), y);
        break;
      case 1:
        pos += snprintf(buf + pos, sizeof(buf) - pos, "%.3s %.3s %02d %0*d",
                        day_names + wd * 3, month_names + mon * 3, d,
                        4 + (y < 0), y);
        if (part == 3) {
          buf[pos++] = ' ';
        }
        break;
      case 2:
        if (y >= 0 && y <= 9999) {
          pos += snprintf(buf + pos, sizeof(buf) - pos, "%04d", y);
        } else {
          pos += snprintf(buf + pos, sizeof(buf) - pos, "%+07d", y);
        }
        pos +=
            snprintf(buf + pos, sizeof(buf) - pos, "-%02d-%02dT", mon + 1, d);
        break;
      case 3:
        pos += snprintf(buf + pos, sizeof(buf) - pos, "%02d/%02d/%0*d", mon + 1,
                        d, 4 + (y < 0), y);
        if (part == 3) {
          buf[pos++] = ',';
          buf[pos++] = ' ';
        }
        break;
    }
  }
  if (part & 2) { /* time part */
    switch (fmt) {
      case 0:
        pos += snprintf(buf + pos, sizeof(buf) - pos, "%02d:%02d:%02d GMT", h,
                        m, s);
        break;
      case 1:
        pos += snprintf(buf + pos, sizeof(buf) - pos, "%02d:%02d:%02d GMT", h,
                        m, s);
        if (tz < 0) {
          buf[pos++] = '-';
          tz = -tz;
        } else {
          buf[pos++] = '+';
        }
        /* tz is >= 0, can use % */
        pos += snprintf(buf + pos, sizeof(buf) - pos, "%02d%02d", tz / 60,
                        tz % 60);
        /* XXX: tack the time zone code? */
        break;
      case 2:
        pos += snprintf(buf + pos, sizeof(buf) - pos, "%02d:%02d:%02d.%03dZ", h,
                        m, s, ms);
        break;
      case 3:
        pos += snprintf(buf + pos, sizeof(buf) - pos, "%02d:%02d:%02d %cM",
                        (h + 1) % 12 - 1, m, s, (h < 12) ? 'A' : 'P');
        break;
    }
  }
  TS_RETURN_OBJECT(
      ret, ts_new_string(ts_runtime_from_object(obj), (const char*)buf, 0));
  return 0;
  //  return JS_NewStringLen(ctx, buf, pos);
}

static int64_t js_Date_UTC(ts_object_t* obj,
                           ts_argument_t args,
                           ts_return_t ret) {
  int64_t argc = args == NULL ? 0 : TS_ARG_COUNT(args);
  // UTC(y, mon, d, h, m, s, ms)
  double fields[] = {0, 0, 1, 0, 0, 0, 0};
  int i, n;
  double a;
  n = argc;
  if (n == 0)
    return -1;  // JS_NAN;
  if (n > 7)
    n = 7;
  for (i = 0; i < n; i++) {
    //    if (JS_ToFloat64(ctx, &a, argv[i]))
    //      return JS_EXCEPTION;
    a = TS_ARG_DOUBLE(args, i);
    if (!isfinite(a))
      return -1;  // JS_NAN;
    fields[i] = trunc(a);
    if (i == 0 && fields[0] >= 0 && fields[0] < 100)
      fields[0] += 1900;
  }
  //  return JS_NewFloat64(ctx, set_date_fields(fields, 0));
  TS_RETURN_DOUBLE(ret, set_date_fields(fields, 0));
}

static void string_skip_spaces(const char* sp, int sp_len, int* pp) {
  while (*pp < sp_len && sp[*pp] == ' ')
    *pp += 1;
}

static void string_skip_non_spaces(const char* sp, int sp_len, int* pp) {
  while (*pp < sp_len && sp[*pp] != ' ')
    *pp += 1;
}

/* parse a numeric field with an optional sign if accept_sign is TRUE */
static int string_get_digits(const char* sp,
                             int sp_len,
                             int* pp,
                             int64_t* pval) {
  int64_t v = 0;
  int c, p = *pp, p_start;

  if (p >= sp_len)
    return -1;
  p_start = p;
  while (p < sp_len) {
    c = sp[p];
    if (!(c >= '0' && c <= '9')) {
      if (p == p_start)
        return -1;
      else
        break;
    }
    v = v * 10 + c - '0';
    p++;
  }
  *pval = v;
  *pp = p;
  return 0;
}

static int string_get_signed_digits(const char* sp,
                                    int sp_len,
                                    int* pp,
                                    int64_t* pval) {
  int res, sgn, p = *pp;

  if (p >= sp_len)
    return -1;

  sgn = sp[p];
  if (sgn == '-' || sgn == '+')
    p++;

  res = string_get_digits(sp, sp_len, &p, pval);
  if (res == 0 && sgn == '-')
    *pval = -*pval;
  *pp = p;
  return res;
}

/* parse a fixed width numeric field */
static int string_get_fixed_width_digits(const char* sp,
                                         int sp_len,
                                         int* pp,
                                         int n,
                                         int64_t* pval) {
  int64_t v = 0;
  int i, c, p = *pp;

  for (i = 0; i < n; i++) {
    if (p >= sp_len)
      return -1;
    c = sp[p];
    if (!(c >= '0' && c <= '9'))
      return -1;
    v = v * 10 + c - '0';
    p++;
  }
  *pval = v;
  *pp = p;
  return 0;
}

static int string_get_milliseconds(const char* sp,
                                   int sp_len,
                                   int* pp,
                                   int64_t* pval) {
  /* parse milliseconds as a fractional part, round to nearest */
  /* XXX: the spec does not indicate which rounding should be used */
  int mul = 1000, ms = 0, p = *pp, c, p_start;
  if (p >= sp_len)
    return -1;
  p_start = p;
  while (p < sp_len) {
    c = sp[p];
    if (!(c >= '0' && c <= '9')) {
      if (p == p_start)
        return -1;
      else
        break;
    }
    if (mul == 1 && c >= '5')
      ms += 1;
    ms += (c - '0') * (mul /= 10);
    p++;
  }
  *pval = ms;
  *pp = p;
  return 0;
}

static int find_abbrev(const char* sp,
                       int sp_len,
                       int p,
                       const char* list,
                       int count) {
  int n, i;

  if (p + 3 <= sp_len) {
    for (n = 0; n < count; n++) {
      for (i = 0; i < 3; i++) {
        if (sp[p + i] != month_names[n * 3 + i])
          goto next;
      }
      return n;
    next:;
    }
  }
  return -1;
}

static int string_get_month(const char* sp,
                            int sp_len,
                            int* pp,
                            int64_t* pval) {
  int n;

  string_skip_spaces(sp, sp_len, pp);
  n = find_abbrev(sp, sp_len, *pp, month_names, 12);
  if (n < 0)
    return -1;

  *pval = n;
  *pp += 3;
  return 0;
}

static uint64_t js_Date_parse(ts_object_t* obj,
                              ts_argument_t args,
                              ts_return_t ret) {
  // parse(s)
  //  JSValue s, rv;
  uint64_t rv;
  int64_t fields[] = {0, 1, 1, 0, 0, 0, 0};
  double fields1[7];
  int64_t tz, hh, mm;
  double d;
  int p, i, c, sgn, l;
  //  const char* sp;int sp_len,
  int is_local;

  //  rv = JS_NAN;

  //   s = JS_ToString(ctx, argv[0]);
  //  if (JS_IsException(s))
  //    return JS_EXCEPTION;

  //  sp = JS_VALUE_GET_STRING(s);
  ts_object_t* s = (ts_object_t*)TS_ARG_OBJECT(args, 0);
  const char* sp = (const char*)ts_string_get_utf8(s);
  int sp_len = ts_string_length(s);
  p = 0;
  if (p < sp_len &&
      (((c = sp[p]) >= '0' && c <= '9') || c == '+' || c == '-')) {
    /* ISO format */
    /* year field can be negative */
    if (string_get_signed_digits(sp, sp_len, &p, &fields[0]))
      goto done;

    for (i = 1; i < 7; i++) {
      if (p >= sp_len)
        break;
      switch (i) {
        case 1:
        case 2:
          c = '-';
          break;
        case 3:
          c = 'T';
          break;
        case 4:
        case 5:
          c = ':';
          break;
        case 6:
          c = '.';
          break;
      }
      if (sp[p] != c)
        break;
      p++;
      if (i == 6) {
        if (string_get_milliseconds(sp, sp_len, &p, &fields[i]))
          goto done;
      } else {
        if (string_get_digits(sp, sp_len, &p, &fields[i]))
          goto done;
      }
    }
    /* no time: UTC by default */
    is_local = (i > 3);
    fields[1] -= 1;

    /* parse the time zone offset if present: [+-]HH:mm or [+-]HHmm */
    tz = 0;
    if (p < sp_len) {
      sgn = sp[p];
      if (sgn == '+' || sgn == '-') {
        p++;
        l = sp_len - p;
        if (l != 4 && l != 5)
          goto done;
        if (string_get_fixed_width_digits(sp, sp_len, &p, 2, &hh))
          goto done;
        if (l == 5) {
          if (sp[p] != ':')
            goto done;
          p++;
        }
        if (string_get_fixed_width_digits(sp, sp_len, &p, 2, &mm))
          goto done;
        tz = hh * 60 + mm;
        if (sgn == '-')
          tz = -tz;
        is_local = ts_false;
      } else if (sgn == 'Z') {
        p++;
        is_local = ts_false;
      } else {
        goto done;
      }
      /* error if extraneous characters */
      if (p != sp_len)
        goto done;
    }
  } else {
    /* toString or toUTCString format */
    /* skip the day of the week */
    string_skip_non_spaces(sp, sp_len, &p);
    string_skip_spaces(sp, sp_len, &p);
    if (p >= sp_len)
      goto done;
    c = sp[p];
    if (c >= '0' && c <= '9') {
      /* day of month first */
      if (string_get_digits(sp, sp_len, &p, &fields[2]))
        goto done;
      if (string_get_month(sp, sp_len, &p, &fields[1]))
        goto done;
    } else {
      /* month first */
      if (string_get_month(sp, sp_len, &p, &fields[1]))
        goto done;
      string_skip_spaces(sp, sp_len, &p);
      if (string_get_digits(sp, sp_len, &p, &fields[2]))
        goto done;
    }
    /* year */
    string_skip_spaces(sp, sp_len, &p);
    if (string_get_signed_digits(sp, sp_len, &p, &fields[0]))
      goto done;

    /* hour, min, seconds */
    string_skip_spaces(sp, sp_len, &p);
    for (i = 0; i < 3; i++) {
      if (i == 1 || i == 2) {
        if (p >= sp_len)
          goto done;
        if (sp[p] != ':')
          goto done;
        p++;
      }
      if (string_get_digits(sp, sp_len, &p, &fields[3 + i]))
        goto done;
    }
    // XXX: parse optional milliseconds?

    /* parse the time zone offset if present: [+-]HHmm */
    is_local = ts_false;
    tz = 0;
    for (tz = 0; p < sp_len; p++) {
      sgn = sp[p];
      if (sgn == '+' || sgn == '-') {
        p++;
        if (string_get_fixed_width_digits(sp, sp_len, &p, 2, &hh))
          goto done;
        if (string_get_fixed_width_digits(sp, sp_len, &p, 2, &mm))
          goto done;
        tz = hh * 60 + mm;
        if (sgn == '-')
          tz = -tz;
        break;
      }
    }
  }
  for (i = 0; i < 7; i++)
    fields1[i] = fields[i];
  d = set_date_fields(fields1, is_local) - tz * 60000;
  rv = d;

done:
  //  JS_FreeValue(ctx, s);
  return rv;
}

// static JSValue js_date_Symbol_toPrimitive(ts_object_t* obj,
//                                           ts_argument_t args,
//                                           ts_return_t ret,
//                                           JSContext* ctx,
//                                           JSValueConst this_val,
//                                           int argc,
//                                           JSValueConst* argv) {
//   // Symbol_toPrimitive(hint)
//   JSValueConst obj = this_val;
//   JSAtom hint = JS_ATOM_NULL;
//   int hint_num;
//
//   if (!JS_IsObject(obj))
//     return JS_ThrowTypeErrorNotAnObject(ctx);
//
//   if (JS_IsString(argv[0])) {
//     hint = JS_ValueToAtom(ctx, argv[0]);
//     if (hint == JS_ATOM_NULL)
//       return JS_EXCEPTION;
//     JS_FreeAtom(ctx, hint);
//   }
//   switch (hint) {
//     case JS_ATOM_number:
// #ifdef CONFIG_BIGNUM
//     case JS_ATOM_integer:
// #endif
//       hint_num = HINT_NUMBER;
//       break;
//     case JS_ATOM_string:
//     case JS_ATOM_default:
//       hint_num = HINT_STRING;
//       break;
//     default:
//       return JS_ThrowTypeError(ctx, "invalid hint");
//   }
//   return JS_ToPrimitive(ctx, obj, hint_num | HINT_FORCE_ORDINARY);
// }

static int _ts_std_date_getTimezoneOffset(ts_object_t* obj,
                                          ts_argument_t args,
                                          ts_return_t ret) {
  // getTimezoneOffset()
  double v = *TS_OBJECT_MEMBER_OF(double, obj, 0);

  //  if (JS_ThisTimeValue(ctx, &v, this_val))
  //    return JS_EXCEPTION;
  //  if (isnan(v))
  //    return JS_NAN;
  //  else
  //    return JS_NewInt64(ctx, getTimezoneOffset((int64_t)trunc(v)));
  TS_RETURN_INT64(ret, getTimezoneOffset((int64_t)trunc(v)));
  return 0;
}

static int _ts_std_date_getTime(ts_object_t* obj,
                                ts_argument_t args,
                                ts_return_t ret) {
  // getTime()
  double v = *TS_OBJECT_MEMBER_OF(double, obj, 0);
  //  if (JS_ThisTimeValue(ctx, &v, this_val))
  //    return JS_EXCEPTION;
  //  return JS_NewFloat64(ctx, v);
  TS_RETURN_DOUBLE(ret, v);
  return 0;
}

static int _ts_std_date_setTime(ts_object_t* obj,
                                ts_argument_t args,
                                ts_return_t ret) {
  // setTime(v)
  ts_debug_check(args != NULL, "setTime() requires 1 argument");
  *TS_OBJECT_MEMBER_OF(double, obj, 0) = TS_ARG_DOUBLE(args, 0);
  return 0;
  //  if (JS_ThisTimeValue(ctx, &v, this_val) || JS_ToFloat64(ctx, &v, argv[0]))
  //    return JS_EXCEPTION;
  //  return JS_SetThisTimeValue(ctx, this_val, time_clip(v));
}

static int _ts_std_date_setYear(ts_object_t* obj,
                                ts_argument_t args,
                                ts_return_t ret) {
  // setYear(y)
  ts_debug_check(args != NULL, "setYear() requires 1 argument");
  double y = TS_ARG_DOUBLE(args, 0);
  //  JSValueConst args[1];
  //
  //  if (JS_ThisTimeValue(ctx, &y, this_val) || JS_ToFloat64(ctx, &y, argv[0]))
  //    return JS_EXCEPTION;
  y = +y;
  if (isfinite(y)) {
    y = trunc(y);
    if (y >= 0 && y < 100)
      y += 1900;
  }
  //  args[0] = JS_NewFloat64(ctx, y);
  TS_DEF_ARGUMENTS(1);
  TS_SET_DOUBLE_ARG(y);
  *TS_OBJECT_MEMBER_OF(double, obj, 0) =
      set_date_field(obj, TS_ARGUMENTS, ret, 0x011);
  return 0;
}

// quickjs copy end

/*
new Date()
new Date(value)
new Date(dateString)
new Date(dateObject)

new Date(year, monthIndex)
new Date(year, monthIndex, day)
new Date(year, monthIndex, day, hours)
new Date(year, monthIndex, day, hours, minutes)
new Date(year, monthIndex, day, hours, minutes, seconds)
new Date(year, monthIndex, day, hours, minutes, seconds, milliseconds)
*/
static int _ts_std_date_constructor(ts_object_t* obj,
                                    ts_argument_t args,
                                    ts_return_t ret) {
  int argc = 0;
  if (args != NULL) {
    //    ts_debug_check(TS_ARG_COUNT(args) > 7,
    //                   "Date constructor requires less than 7 arguments");
    argc = TS_ARG_COUNT(args);
  }
  *TS_OBJECT_MEMBER_OF(double, obj, 0) = args ? TS_ARG_DOUBLE(args, 0) : 0;
  if (argc > 7) {
    argc = 7;
  }

  double val;

  if (argc == 0) {
    // new Date()
    // return now
    val = date_now();
  } else if (argc == 1) {
    /*
        new Date(value)
        new Date(dateString)
        new Date(dateObject)
     */
    // todo
    val = TS_ARG_DOUBLE(args, 0);
  } else {
    /*
        new Date(year, monthIndex)
        new Date(year, monthIndex, day)
        new Date(year, monthIndex, day, hours)
        new Date(year, monthIndex, day, hours, minutes)
        new Date(year, monthIndex, day, hours, minutes, seconds)
        new Date(year, monthIndex, day, hours, minutes, seconds, milliseconds)
     */
    int i;
    double fields[] = {0, 0, 1, 0, 0, 0, 0};
    for (i = 0; i < argc; i++) {
      fields[i] = trunc(TS_ARG_DOUBLE(args, i));
      if (i == 0 && fields[0] >= 0 && fields[0] < 100) {
        fields[0] += 1900;
      }
    }
    val = (i == argc) ? set_date_fields(fields, 1) : NAN;
  }
  *TS_OBJECT_MEMBER_OF(double, obj, 0) = val;
  // TS_SET_FIELD(double, obj, ts_method_last + 0, val);
}

static void _ts_std_date_destroy(ts_object_t* obj) {
  // nothing to do.
}

#define TS_STD_DATE_GET_FIELD_DEF(NAME, MAGIC)                          \
  static int _ts_std_date_##NAME(ts_object_t* self, ts_argument_t args, \
                                 ts_return_t ret) {                     \
    return _ts_date_get_field(self, args, ret, (MAGIC));                \
  }

static int _ts_std_date_now(ts_object_t* self,
                            ts_argument_t args,
                            ts_return_t ret) {
  TS_RETURN_DOUBLE(ret, date_now());
  return 0;
}

static int _ts_std_date_parse(ts_object_t* self,
                              ts_argument_t args,
                              ts_return_t ret) {
  // todo
  return 0;
}

static int _ts_std_date_UTC(ts_object_t* self,
                            ts_argument_t args,
                            ts_return_t ret) {
  ts_debug_check(args != NULL && TS_ARG_COUNT(args) > 7, "CHECK");
  double fields[] = {0, 0, 1, 0, 0, 0, 0};
  int i, n;
  double a;

  n = TS_ARG_COUNT(args);
  if (n == 0)
    return -1;  // JS_NAN;
  if (n > 7)
    n = 7;
  for (i = 0; i < n; i++) {
    //    if (JS_ToFloat64(ctx, &a, argv[i]))
    //      return JS_EXCEPTION;
    if (!isfinite(a))
      return -1;  // JS_NAN;
    fields[i] = trunc(a);
    if (i == 0 && fields[0] >= 0 && fields[0] < 100)
      fields[0] += 1900;
  }
  TS_RETURN_DOUBLE(ret, set_date_fields(fields, 0));
  return 0;
}

#define TS_STD_DATE_SET_FIELD_DEF(NAME, MAGIC)                          \
  static int _ts_std_date_##NAME(ts_object_t* self, ts_argument_t args, \
                                 ts_return_t ret) {                     \
    *TS_OBJECT_MEMBER_OF(double, self, 0) =                             \
        set_date_field(self, args, ret, (MAGIC));                       \
    return 0;                                                           \
  }

#define TS_STD_DATE_GET_STRING_DEF(NAME, MAGIC)                         \
  static int _ts_std_date_##NAME(ts_object_t* self, ts_argument_t args, \
                                 ts_return_t ret) {                     \
    get_date_string(self, args, ret, (MAGIC));                          \
    return 0;                                                           \
  }

// JS_CFUNC_DEF("valueOf", 0, _ts_std_date_getTime ),
TS_STD_DATE_GET_STRING_DEF(toString, 0x13)
// JS_CFUNC_DEF("[Symbol.toPrimitive]", 1, js_date_Symbol_toPrimitive ),
TS_STD_DATE_GET_STRING_DEF(toUTCString, 0x03)
TS_STD_DATE_GET_STRING_DEF(toISOString, 0x23)
TS_STD_DATE_GET_STRING_DEF(toDateString, 0x11)
TS_STD_DATE_GET_STRING_DEF(toTimeString, 0x12)
TS_STD_DATE_GET_STRING_DEF(toLocaleString, 0x33)
TS_STD_DATE_GET_STRING_DEF(toLocaleDateString, 0x31)
TS_STD_DATE_GET_STRING_DEF(toLocaleTimeString, 0x32)
TS_STD_DATE_GET_FIELD_DEF(getYear, 0x101)
TS_STD_DATE_GET_FIELD_DEF(getFullYear, 0x01)
TS_STD_DATE_GET_FIELD_DEF(getUTCFullYear, 0x00)
TS_STD_DATE_GET_FIELD_DEF(getMonth, 0x11)
TS_STD_DATE_GET_FIELD_DEF(getUTCMonth, 0x10)
TS_STD_DATE_GET_FIELD_DEF(getDate, 0x21)
TS_STD_DATE_GET_FIELD_DEF(getUTCDate, 0x20)
TS_STD_DATE_GET_FIELD_DEF(getHours, 0x31)
TS_STD_DATE_GET_FIELD_DEF(getUTCHours, 0x30)
TS_STD_DATE_GET_FIELD_DEF(getMinutes, 0x41)
TS_STD_DATE_GET_FIELD_DEF(getUTCMinutes, 0x40)
TS_STD_DATE_GET_FIELD_DEF(getSeconds, 0x51)
TS_STD_DATE_GET_FIELD_DEF(getUTCSeconds, 0x50)
TS_STD_DATE_GET_FIELD_DEF(getMilliseconds, 0x61)
TS_STD_DATE_GET_FIELD_DEF(getUTCMilliseconds, 0x60)
TS_STD_DATE_GET_FIELD_DEF(getDay, 0x71)
TS_STD_DATE_GET_FIELD_DEF(getUTCDay, 0x70)
TS_STD_DATE_SET_FIELD_DEF(setMilliseconds, 0x671)
TS_STD_DATE_SET_FIELD_DEF(setUTCMilliseconds, 0x670)
TS_STD_DATE_SET_FIELD_DEF(setSeconds, 0x571)
TS_STD_DATE_SET_FIELD_DEF(setUTCSeconds, 0x570)
TS_STD_DATE_SET_FIELD_DEF(setMinutes, 0x471)
TS_STD_DATE_SET_FIELD_DEF(setUTCMinutes, 0x470)
TS_STD_DATE_SET_FIELD_DEF(setHours, 0x371)
TS_STD_DATE_SET_FIELD_DEF(setUTCHours, 0x370)
TS_STD_DATE_SET_FIELD_DEF(setDate, 0x231)
TS_STD_DATE_SET_FIELD_DEF(setUTCDate, 0x230)
TS_STD_DATE_SET_FIELD_DEF(setMonth, 0x131)
TS_STD_DATE_SET_FIELD_DEF(setUTCMonth, 0x130)
TS_STD_DATE_SET_FIELD_DEF(setFullYear, 0x031)
TS_STD_DATE_SET_FIELD_DEF(setUTCFullYear, 0x030)
// JS_CFUNC_DEF("toJSON", 1, js_date_toJSON ),

static int PLACEHOLDER() {
  //  TS_THORW_ERROR()
  return -1;
}

static TS_VTABLE_DEF(_ts_std_date_vt, 51) = {  //
    TS_VTABLE_BASE(sizeof(ts_std_date_t) + sizeof(double),
                   "Date",
                   0,
                   TS_VTABLE_NEMBER_COUNT(_ts_std_date_vt),
                   _ts_std_date_constructor,
                   _ts_std_date_destroy,
                   NULL,
                   NULL),
    {
        {.method = _ts_std_date_now},
        {.method = _ts_std_date_parse},
        {.method = _ts_std_date_UTC},
        {.method = PLACEHOLDER},  // _ts_std_date_valueOf
        {.method = _ts_std_date_toString},
        {.method = PLACEHOLDER},  // [Symbol.toPrimitive]
        {.method = _ts_std_date_toUTCString},
        {.method = _ts_std_date_toUTCString},  // alias to toGMTString
        {.method = _ts_std_date_toISOString},
        {.method = _ts_std_date_toDateString},
        {.method = _ts_std_date_toTimeString},
        {.method = _ts_std_date_toLocaleString},
        {.method = _ts_std_date_toLocaleDateString},
        {.method = _ts_std_date_toLocaleTimeString},
        {.method =
             _ts_std_date_getTimezoneOffset},  // _ts_std_date_getTimezoneOffset
        {.method = _ts_std_date_getTime},      // _ts_std_date_getTime
        {.method = _ts_std_date_getYear},
        {.method = _ts_std_date_getFullYear},
        {.method = _ts_std_date_getUTCFullYear},
        {.method = _ts_std_date_getMonth},
        {.method = _ts_std_date_getUTCMonth},
        {.method = _ts_std_date_getDate},
        {.method = _ts_std_date_getUTCDate},
        {.method = _ts_std_date_getHours},
        {.method = _ts_std_date_getUTCHours},
        {.method = _ts_std_date_getMinutes},
        {.method = _ts_std_date_getUTCMinutes},
        {.method = _ts_std_date_getSeconds},
        {.method = _ts_std_date_getUTCSeconds},
        {.method = _ts_std_date_getMilliseconds},
        {.method = _ts_std_date_getUTCMilliseconds},
        {.method = _ts_std_date_getDay},
        {.method = _ts_std_date_getUTCDay},
        {.method = _ts_std_date_setTime},  //_ts_std_date_setTime
        {.method = _ts_std_date_setMilliseconds},
        {.method = _ts_std_date_setUTCMilliseconds},
        {.method = _ts_std_date_setSeconds},
        {.method = _ts_std_date_setUTCSeconds},
        {.method = _ts_std_date_setMinutes},
        {.method = _ts_std_date_setUTCMinutes},
        {.method = _ts_std_date_setHours},
        {.method = _ts_std_date_setUTCHours},
        {.method = _ts_std_date_setDate},
        {.method = _ts_std_date_setUTCDate},
        {.method = _ts_std_date_setMonth},
        {.method = _ts_std_date_setUTCMonth},
        {.method = _ts_std_date_setYear},  // _ts_std_date_setYear
        {.method = _ts_std_date_setFullYear},
        {.method = _ts_std_date_setUTCFullYear},
        {.method = PLACEHOLDER},         // _ts_std_date_toJSON
        {.field = sizeof(ts_object_t)},  // field timestamp
    }};

ts_vtable_t* ts_get_std_date_vtable() {
  return &_ts_std_date_vt.base;
}
