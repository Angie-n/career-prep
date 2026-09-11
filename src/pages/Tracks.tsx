import { WorkTrack } from './WorkTrack'

export function Applications() {
  return <WorkTrack category="applications" kind="apps-block" />
}

export function Dsa({ pane }: { pane?: 'home' | 'tracker' }) {
  return <WorkTrack category="dsa" kind="dsa-block" pane={pane} />
}
