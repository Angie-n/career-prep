import { WorkTrack } from './WorkTrack'

export function Applications({ pane }: { pane?: 'home' | 'tracker' }) {
  return <WorkTrack category="applications" kind="apps-block" pane={pane} />
}

export function Dsa({ pane }: { pane?: 'home' | 'tracker' }) {
  return <WorkTrack category="dsa" kind="dsa-block" pane={pane} />
}
