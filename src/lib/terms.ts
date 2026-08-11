export interface TermDate {
  term: number;
  label: string;
  start: string;
  end: string;
}

export const TERM_DATES: TermDate[] = [
  { term: 1, label: "1º Bimestre", start: "23/02", end: "17/04" },
  { term: 2, label: "2º Bimestre", start: "27/04", end: "26/06" },
  { term: 3, label: "3º Bimestre", start: "10/08", end: "28/08" },
  { term: 4, label: "4º Bimestre", start: "19/10", end: "13/11" },
];

export function getCurrentTerm(): number {
  const now = new Date();
  const year = now.getFullYear();
  
  // Sort by date to find which one we are in or most recently passed
  const dates = TERM_DATES.map(d => {
    const [startDay, startMonth] = d.start.split("/").map(Number);
    const [endDay, endMonth] = d.end.split("/").map(Number);
    return {
      term: d.term,
      start: new Date(year, startMonth - 1, startDay),
      end: new Date(year, endMonth - 1, endDay)
    };
  });

  // If before first term
  if (now < dates[0].start) return 1;

  for (let i = 0; i < dates.length; i++) {
    if (now >= dates[i].start && now <= dates[i].end) {
      return dates[i].term;
    }
    // If between terms, return the upcoming one
    if (i < dates.length - 1 && now > dates[i].end && now < dates[i+1].start) {
      return dates[i+1].term;
    }
  }

  // If after last term
  return 4;
}
