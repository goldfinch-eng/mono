// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {Test} from "forge-std/Test.sol";
import {MonthlyPeriodMapper} from "../../../protocol/core/schedule/MonthlyPeriodMapper.sol";
import {IPeriodMapper} from "../../../interfaces/IPeriodMapper.sol";

// contract MonthlyPeriodMapperTest is Test {
//   IPeriodMapper internal s = new MonthlyPeriodMapper();

//   function testStartOfIsCorrect(uint64 period) public {
//     vm.assume(period < expectedStartTimes.length);
//     assertEq(uint256(s.startOf(period)), uint256(expectedStartTimes[period]));
//   }

//   function testPeriodOfIsCorrect(uint64 period, uint64 timestamp) public {
//     vm.assume(period < expectedStartTimes.length - 1);
//     vm.assume(timestamp >= expectedStartTimes[period]);
//     vm.assume(timestamp < expectedStartTimes[period + 1]);
//     assertEq(uint256(s.periodOf(timestamp)), uint256(period));
//   }

//   /* Generated using:
//   ````node
//  const x = new Date(0)
//  for(let i = 0; i < 1000; i++) {
//    const c = new Date(x);
//    c.setUTCMonth(i);
//    console.log(`${c.getTime() / 1000}, // ${c.toUTCString()}`);
//  }
//   ```
//   */
//   uint64[] private expectedStartTimes = [
//     0, // Thu, 01 Jan 1970 00:00:00 GMT
//     15638400, // Wed, 01 Jul 1970 00:00:00 GMT
//     31536000, // Fri, 01 Jan 1971 00:00:00 GMT
//     47174400, // Thu, 01 Jul 1971 00:00:00 GMT
//     63072000, // Sat, 01 Jan 1972 00:00:00 GMT
//     78796800, // Sat, 01 Jul 1972 00:00:00 GMT
//     94694400, // Mon, 01 Jan 1973 00:00:00 GMT
//     110332800, // Sun, 01 Jul 1973 00:00:00 GMT
//     126230400, // Tue, 01 Jan 1974 00:00:00 GMT
//     141868800, // Mon, 01 Jul 1974 00:00:00 GMT
//     157766400, // Wed, 01 Jan 1975 00:00:00 GMT
//     173404800, // Tue, 01 Jul 1975 00:00:00 GMT
//     189302400, // Thu, 01 Jan 1976 00:00:00 GMT
//     205027200, // Thu, 01 Jul 1976 00:00:00 GMT
//     220924800, // Sat, 01 Jan 1977 00:00:00 GMT
//     236563200, // Fri, 01 Jul 1977 00:00:00 GMT
//     252460800, // Sun, 01 Jan 1978 00:00:00 GMT
//     268099200, // Sat, 01 Jul 1978 00:00:00 GMT
//     283996800, // Mon, 01 Jan 1979 00:00:00 GMT
//     299635200, // Sun, 01 Jul 1979 00:00:00 GMT
//     315532800, // Tue, 01 Jan 1980 00:00:00 GMT
//     331257600, // Tue, 01 Jul 1980 00:00:00 GMT
//     347155200, // Thu, 01 Jan 1981 00:00:00 GMT
//     362793600, // Wed, 01 Jul 1981 00:00:00 GMT
//     378691200, // Fri, 01 Jan 1982 00:00:00 GMT
//     394329600, // Thu, 01 Jul 1982 00:00:00 GMT
//     410227200, // Sat, 01 Jan 1983 00:00:00 GMT
//     425865600, // Fri, 01 Jul 1983 00:00:00 GMT
//     441763200, // Sun, 01 Jan 1984 00:00:00 GMT
//     457488000, // Sun, 01 Jul 1984 00:00:00 GMT
//     473385600, // Tue, 01 Jan 1985 00:00:00 GMT
//     489024000, // Mon, 01 Jul 1985 00:00:00 GMT
//     504921600, // Wed, 01 Jan 1986 00:00:00 GMT
//     520560000, // Tue, 01 Jul 1986 00:00:00 GMT
//     536457600, // Thu, 01 Jan 1987 00:00:00 GMT
//     552096000, // Wed, 01 Jul 1987 00:00:00 GMT
//     567993600, // Fri, 01 Jan 1988 00:00:00 GMT
//     583718400, // Fri, 01 Jul 1988 00:00:00 GMT
//     599616000, // Sun, 01 Jan 1989 00:00:00 GMT
//     615254400, // Sat, 01 Jul 1989 00:00:00 GMT
//     631152000, // Mon, 01 Jan 1990 00:00:00 GMT
//     646790400, // Sun, 01 Jul 1990 00:00:00 GMT
//     662688000, // Tue, 01 Jan 1991 00:00:00 GMT
//     678326400, // Mon, 01 Jul 1991 00:00:00 GMT
//     694224000, // Wed, 01 Jan 1992 00:00:00 GMT
//     709948800, // Wed, 01 Jul 1992 00:00:00 GMT
//     725846400, // Fri, 01 Jan 1993 00:00:00 GMT
//     741484800, // Thu, 01 Jul 1993 00:00:00 GMT
//     757382400, // Sat, 01 Jan 1994 00:00:00 GMT
//     773020800, // Fri, 01 Jul 1994 00:00:00 GMT
//     788918400, // Sun, 01 Jan 1995 00:00:00 GMT
//     804556800, // Sat, 01 Jul 1995 00:00:00 GMT
//     820454400, // Mon, 01 Jan 1996 00:00:00 GMT
//     836179200, // Mon, 01 Jul 1996 00:00:00 GMT
//     852076800, // Wed, 01 Jan 1997 00:00:00 GMT
//     867715200, // Tue, 01 Jul 1997 00:00:00 GMT
//     883612800, // Thu, 01 Jan 1998 00:00:00 GMT
//     899251200, // Wed, 01 Jul 1998 00:00:00 GMT
//     915148800, // Fri, 01 Jan 1999 00:00:00 GMT
//     930787200, // Thu, 01 Jul 1999 00:00:00 GMT
//     946684800, // Sat, 01 Jan 2000 00:00:00 GMT
//     962409600, // Sat, 01 Jul 2000 00:00:00 GMT
//     978307200, // Mon, 01 Jan 2001 00:00:00 GMT
//     993945600, // Sun, 01 Jul 2001 00:00:00 GMT
//     1009843200, // Tue, 01 Jan 2002 00:00:00 GMT
//     1025481600, // Mon, 01 Jul 2002 00:00:00 GMT
//     1041379200, // Wed, 01 Jan 2003 00:00:00 GMT
//     1057017600, // Tue, 01 Jul 2003 00:00:00 GMT
//     1072915200, // Thu, 01 Jan 2004 00:00:00 GMT
//     1088640000, // Thu, 01 Jul 2004 00:00:00 GMT
//     1104537600, // Sat, 01 Jan 2005 00:00:00 GMT
//     1120176000, // Fri, 01 Jul 2005 00:00:00 GMT
//     1136073600, // Sun, 01 Jan 2006 00:00:00 GMT
//     1151712000, // Sat, 01 Jul 2006 00:00:00 GMT
//     1167609600, // Mon, 01 Jan 2007 00:00:00 GMT
//     1183248000, // Sun, 01 Jul 2007 00:00:00 GMT
//     1199145600, // Tue, 01 Jan 2008 00:00:00 GMT
//     1214870400, // Tue, 01 Jul 2008 00:00:00 GMT
//     1230768000, // Thu, 01 Jan 2009 00:00:00 GMT
//     1246406400, // Wed, 01 Jul 2009 00:00:00 GMT
//     1262304000, // Fri, 01 Jan 2010 00:00:00 GMT
//     1277942400, // Thu, 01 Jul 2010 00:00:00 GMT
//     1293840000, // Sat, 01 Jan 2011 00:00:00 GMT
//     1309478400, // Fri, 01 Jul 2011 00:00:00 GMT
//     1325376000, // Sun, 01 Jan 2012 00:00:00 GMT
//     1341100800, // Sun, 01 Jul 2012 00:00:00 GMT
//     1356998400, // Tue, 01 Jan 2013 00:00:00 GMT
//     1372636800, // Mon, 01 Jul 2013 00:00:00 GMT
//     1388534400, // Wed, 01 Jan 2014 00:00:00 GMT
//     1404172800, // Tue, 01 Jul 2014 00:00:00 GMT
//     1420070400, // Thu, 01 Jan 2015 00:00:00 GMT
//     1435708800, // Wed, 01 Jul 2015 00:00:00 GMT
//     1451606400, // Fri, 01 Jan 2016 00:00:00 GMT
//     1467331200, // Fri, 01 Jul 2016 00:00:00 GMT
//     1483228800, // Sun, 01 Jan 2017 00:00:00 GMT
//     1498867200, // Sat, 01 Jul 2017 00:00:00 GMT
//     1514764800, // Mon, 01 Jan 2018 00:00:00 GMT
//     1530403200, // Sun, 01 Jul 2018 00:00:00 GMT
//     1546300800, // Tue, 01 Jan 2019 00:00:00 GMT
//     1561939200, // Mon, 01 Jul 2019 00:00:00 GMT
//     1577836800, // Wed, 01 Jan 2020 00:00:00 GMT
//     1593561600, // Wed, 01 Jul 2020 00:00:00 GMT
//     1609459200, // Fri, 01 Jan 2021 00:00:00 GMT
//     1625097600, // Thu, 01 Jul 2021 00:00:00 GMT
//     1640995200, // Sat, 01 Jan 2022 00:00:00 GMT
//     1656633600, // Fri, 01 Jul 2022 00:00:00 GMT
//     1672531200, // Sun, 01 Jan 2023 00:00:00 GMT
//     1688169600, // Sat, 01 Jul 2023 00:00:00 GMT
//     1704067200, // Mon, 01 Jan 2024 00:00:00 GMT
//     1719792000, // Mon, 01 Jul 2024 00:00:00 GMT
//     1735689600, // Wed, 01 Jan 2025 00:00:00 GMT
//     1751328000, // Tue, 01 Jul 2025 00:00:00 GMT
//     1767225600, // Thu, 01 Jan 2026 00:00:00 GMT
//     1782864000, // Wed, 01 Jul 2026 00:00:00 GMT
//     1798761600, // Fri, 01 Jan 2027 00:00:00 GMT
//     1814400000, // Thu, 01 Jul 2027 00:00:00 GMT
//     1830297600, // Sat, 01 Jan 2028 00:00:00 GMT
//     1846022400, // Sat, 01 Jul 2028 00:00:00 GMT
//     1861920000, // Mon, 01 Jan 2029 00:00:00 GMT
//     1877558400, // Sun, 01 Jul 2029 00:00:00 GMT
//     1893456000, // Tue, 01 Jan 2030 00:00:00 GMT
//     1909094400, // Mon, 01 Jul 2030 00:00:00 GMT
//     1924992000, // Wed, 01 Jan 2031 00:00:00 GMT
//     1940630400, // Tue, 01 Jul 2031 00:00:00 GMT
//     1956528000, // Thu, 01 Jan 2032 00:00:00 GMT
//     1972252800, // Thu, 01 Jul 2032 00:00:00 GMT
//     1988150400, // Sat, 01 Jan 2033 00:00:00 GMT
//     2003788800, // Fri, 01 Jul 2033 00:00:00 GMT
//     2019686400, // Sun, 01 Jan 2034 00:00:00 GMT
//     2035324800, // Sat, 01 Jul 2034 00:00:00 GMT
//     2051222400, // Mon, 01 Jan 2035 00:00:00 GMT
//     2066860800, // Sun, 01 Jul 2035 00:00:00 GMT
//     2082758400, // Tue, 01 Jan 2036 00:00:00 GMT
//     2098483200, // Tue, 01 Jul 2036 00:00:00 GMT
//     2114380800, // Thu, 01 Jan 2037 00:00:00 GMT
//     2130019200, // Wed, 01 Jul 2037 00:00:00 GMT
//     2145916800, // Fri, 01 Jan 2038 00:00:00 GMT
//     2161555200, // Thu, 01 Jul 2038 00:00:00 GMT
//     2177452800, // Sat, 01 Jan 2039 00:00:00 GMT
//     2193091200, // Fri, 01 Jul 2039 00:00:00 GMT
//     2208988800, // Sun, 01 Jan 2040 00:00:00 GMT
//     2224713600, // Sun, 01 Jul 2040 00:00:00 GMT
//     2240611200, // Tue, 01 Jan 2041 00:00:00 GMT
//     2256249600, // Mon, 01 Jul 2041 00:00:00 GMT
//     2272147200, // Wed, 01 Jan 2042 00:00:00 GMT
//     2287785600, // Tue, 01 Jul 2042 00:00:00 GMT
//     2303683200, // Thu, 01 Jan 2043 00:00:00 GMT
//     2319321600, // Wed, 01 Jul 2043 00:00:00 GMT
//     2335219200, // Fri, 01 Jan 2044 00:00:00 GMT
//     2350944000, // Fri, 01 Jul 2044 00:00:00 GMT
//     2366841600, // Sun, 01 Jan 2045 00:00:00 GMT
//     2382480000, // Sat, 01 Jul 2045 00:00:00 GMT
//     2398377600, // Mon, 01 Jan 2046 00:00:00 GMT
//     2414016000, // Sun, 01 Jul 2046 00:00:00 GMT
//     2429913600, // Tue, 01 Jan 2047 00:00:00 GMT
//     2445552000, // Mon, 01 Jul 2047 00:00:00 GMT
//     2461449600, // Wed, 01 Jan 2048 00:00:00 GMT
//     2477174400, // Wed, 01 Jul 2048 00:00:00 GMT
//     2493072000, // Fri, 01 Jan 2049 00:00:00 GMT
//     2508710400, // Thu, 01 Jul 2049 00:00:00 GMT
//     2524608000, // Sat, 01 Jan 2050 00:00:00 GMT
//     2540246400, // Fri, 01 Jul 2050 00:00:00 GMT
//     2556144000, // Sun, 01 Jan 2051 00:00:00 GMT
//     2571782400, // Sat, 01 Jul 2051 00:00:00 GMT
//     2587680000, // Mon, 01 Jan 2052 00:00:00 GMT
//     2603404800, // Mon, 01 Jul 2052 00:00:00 GMT
//     2619302400 // Wed, 01 Jan 2053 00:00:00 GMT
//   ];
// }
