const data = [
  { paymentPeriod: "1", date: "Feb 15, 2023", principal: 0, interest: 24000 },
  { paymentPeriod: "2", date: "Feb 15, 2023", principal: 0, interest: 24000 },
  { paymentPeriod: "3", date: "Feb 15, 2023", principal: 0, interest: 24000 },
  { paymentPeriod: "3", date: "Feb 15, 2023", principal: 0, interest: 24000 },
  { paymentPeriod: "4", date: "Feb 15, 2023", principal: 0, interest: 24000 },
  { paymentPeriod: "5", date: "Feb 15, 2023", principal: 0, interest: 24000 },
  { paymentPeriod: "6", date: "Feb 15, 2023", principal: 0, interest: 24000 },
  { paymentPeriod: "7", date: "Feb 15, 2023", principal: 0, interest: 24000 },
  { paymentPeriod: "8", date: "Feb 15, 2023", principal: 0, interest: 24000 },
  { paymentPeriod: "9", date: "Feb 15, 2023", principal: 0, interest: 24000 },
  {
    paymentPeriod: "10",
    date: "Feb 15, 2023",
    principal: 0,
    interest: 24000,
  },
  {
    paymentPeriod: "11",
    date: "Feb 15, 2023",
    principal: 0,
    interest: 24000,
  },
  {
    paymentPeriod: "12",
    date: "Feb 15, 2023",
    principal: 0,
    interest: 24000,
  },
  {
    paymentPeriod: "13",
    date: "Feb 15, 2023",
    principal: 0,
    interest: 24000,
  },
  {
    paymentPeriod: "14",
    date: "Feb 15, 2023",
    principal: 0,
    interest: 24000,
  },
  {
    paymentPeriod: "15",
    date: "Feb 15, 2023",
    principal: 0,
    interest: 24000,
  },
  {
    paymentPeriod: "16",
    date: "Feb 15, 2023",
    principal: 0,
    interest: 24000,
  },
  {
    paymentPeriod: "17",
    date: "Feb 15, 2023",
    principal: 0,
    interest: 24000,
  },
  {
    paymentPeriod: "18",
    date: "Feb 15, 2023",
    principal: 0,
    interest: 24000,
  },
  {
    paymentPeriod: "19",
    date: "Feb 15, 2023",
    principal: 0,
    interest: 24000,
  },
  {
    paymentPeriod: "20",
    date: "Feb 15, 2023",
    principal: 0,
    interest: 24000,
  },
  {
    paymentPeriod: "21",
    date: "Feb 15, 2023",
    principal: 0,
    interest: 24000,
  },
  {
    paymentPeriod: "22",
    date: "Feb 15, 2023",
    principal: 0,
    interest: 24000,
  },
  {
    paymentPeriod: "23",
    date: "Feb 15, 2023",
    principal: 0,
    interest: 24000,
  },
  {
    paymentPeriod: "24",
    date: "Feb 15, 2023",
    principal: 2130000,
    interest: 24000,
  },
];

export function RepaymentScheduleTable({}) {
  return (
    <div className="max-h-[20rem] overflow-y-auto">
      <table className="w-full">
        <thead className="sticky top-0">
          <div className="grid w-full grid-cols-12 border-y border-sand-300 bg-sand-50 text-xs">
            <div className="col-span-1 px-3.5 py-2">No.</div>
            <div className="col-span-4 px-3.5 py-2">Est. payment date</div>
            <div className="col-span-2 px-3.5 py-2 text-right">
              Principal due
            </div>
            <div className="col-span-5 px-3.5 py-2 text-right">
              Interest due
            </div>
          </div>
        </thead>
        <tbody className="max-h-[20rem] overflow-y-auto">
          {data.map((payment) => (
            <div
              key={payment.paymentPeriod}
              className="grid w-full grid-cols-12 border-y border-sand-300 text-xs first:border-t-0 last:border-b-0"
            >
              <div className="col-span-1 px-3.5 py-3">
                {payment.paymentPeriod}
              </div>
              <div className="col-span-4 px-3.5 py-3">{payment.date}</div>
              <div className="col-span-2 px-3.5 py-3 text-right">
                {payment.principal}
              </div>
              <div className="col-span-5 px-3.5 py-3 text-right">
                {payment.interest}
              </div>
            </div>
          ))}
        </tbody>
      </table>
    </div>
  );
}
