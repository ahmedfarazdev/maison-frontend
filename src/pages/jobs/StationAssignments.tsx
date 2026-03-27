// ============================================================
// Station Assignments — Job Management
// Assign team members to operating stations
// The bridge between people and stations
// ============================================================
import { useState, useMemo } from 'react';
import { PageHeader, SectionCard } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Users, UserPlus, Settings2, Clock, CheckCircle2,
  MapPin, ArrowRight, Layers, Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---- Types ----
interface TeamMember {
  id: string;
  name: string;
  role: string;
  skills: string[];
  currentStation?: string;
  status: 'active' | 'break' | 'off_duty';
  shiftsToday: number;
}

interface Station {
  id: string;
  name: string;
  description: string;
  maxCapacity: number;
  assignedMembers: string[]; // member IDs
  currentLoad: number; // jobs in queue
  color: string;
}

// ---- Mock Data ----
const mockMembers: TeamMember[] = [
  { id: 'TM-01', name: 'Khalid Al Ameri', role: 'Senior Operator', skills: ['decanting', 'qc', 'labeling'], currentStation: 'S4', status: 'active', shiftsToday: 1 },
  { id: 'TM-02', name: 'Fatima Hassan', role: 'Operator', skills: ['picking', 'compiling', 'shipping'], currentStation: 'S1', status: 'active', shiftsToday: 1 },
  { id: 'TM-03', name: 'Omar Saeed', role: 'Operator', skills: ['labeling', 'printing', 'decanting'], currentStation: 'S3', status: 'active', shiftsToday: 1 },
  { id: 'TM-04', name: 'Noura Khalil', role: 'QC Specialist', skills: ['qc', 'compiling'], currentStation: 'S5', status: 'active', shiftsToday: 2 },
  { id: 'TM-05', name: 'Ahmed Mansour', role: 'Operator', skills: ['picking', 'decanting', 'labeling'], status: 'break', shiftsToday: 1 },
  { id: 'TM-06', name: 'Layla Noor', role: 'Junior Operator', skills: ['picking', 'compiling'], status: 'active', shiftsToday: 1 },
  { id: 'TM-07', name: 'Youssef Ali', role: 'Shipping Lead', skills: ['shipping', 'qc', 'compiling'], currentStation: 'S6', status: 'active', shiftsToday: 1 },
  { id: 'TM-08', name: 'Reem Al Falasi', role: 'Operator', skills: ['decanting', 'labeling'], status: 'off_duty', shiftsToday: 0 },
];

const mockStations: Station[] = [
  { id: 'S1', name: 'S1 — Picking', description: 'Gather materials from inventory', maxCapacity: 3, assignedMembers: ['TM-02'], currentLoad: 8, color: 'bg-blue-500' },
  { id: 'S2', name: 'S2 — Labeling', description: 'Prepare and apply labels', maxCapacity: 2, assignedMembers: [], currentLoad: 5, color: 'bg-indigo-500' },
  { id: 'S3', name: 'S3 — Printing', description: 'Print cards, inserts, materials', maxCapacity: 2, assignedMembers: ['TM-03'], currentLoad: 3, color: 'bg-purple-500' },
  { id: 'S4', name: 'S4 — Decanting', description: 'Fill vials with perfume', maxCapacity: 3, assignedMembers: ['TM-01'], currentLoad: 12, color: 'bg-amber-500' },
  { id: 'S5', name: 'S5 — QC & Compile', description: 'Quality check and assemble', maxCapacity: 3, assignedMembers: ['TM-04'], currentLoad: 6, color: 'bg-orange-500' },
  { id: 'S6', name: 'S6 — Shipping', description: 'Pack and ship orders', maxCapacity: 2, assignedMembers: ['TM-07'], currentLoad: 4, color: 'bg-emerald-500' },
];

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  break: 'bg-amber-100 text-amber-700',
  off_duty: 'bg-slate-100 text-slate-500',
};

// ---- Component ----
export default function StationAssignments() {
  const [assignDialog, setAssignDialog] = useState<{ memberId: string } | null>(null);
  const [selectedStation, setSelectedStation] = useState<string>('');

  const unassigned = mockMembers.filter(m => !m.currentStation && m.status !== 'off_duty');

  const handleAssign = () => {
    if (!assignDialog || !selectedStation) return;
    const member = mockMembers.find(m => m.id === assignDialog.memberId);
    toast.success(`${member?.name} assigned to ${selectedStation}`);
    setAssignDialog(null);
    setSelectedStation('');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Station Assignments"
        subtitle="Assign team members to operating stations — manage capacity and workload"
      />

      {/* Overview KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-50"><Users className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold">{mockMembers.filter(m => m.status === 'active').length}</p>
                <p className="text-xs text-muted-foreground">Active Team Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-50"><MapPin className="w-5 h-5 text-amber-600" /></div>
              <div>
                <p className="text-2xl font-bold">{mockStations.filter(s => s.assignedMembers.length > 0).length}/{mockStations.length}</p>
                <p className="text-xs text-muted-foreground">Stations Staffed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-red-50"><UserPlus className="w-5 h-5 text-red-600" /></div>
              <div>
                <p className="text-2xl font-bold">{unassigned.length}</p>
                <p className="text-xs text-muted-foreground">Unassigned (Available)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-purple-50"><Layers className="w-5 h-5 text-purple-600" /></div>
              <div>
                <p className="text-2xl font-bold">{mockStations.reduce((s, st) => s + st.currentLoad, 0)}</p>
                <p className="text-xs text-muted-foreground">Total Jobs in Queue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Station Grid */}
      <SectionCard title="Station Overview" subtitle="Drag team members between stations or click to assign">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {mockStations.map(station => {
            const members = mockMembers.filter(m => station.assignedMembers.includes(m.id));
            const utilization = station.assignedMembers.length / station.maxCapacity;
            return (
              <Card key={station.id} className="border shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn('w-3 h-3 rounded-full', station.color)} />
                      <h3 className="font-semibold text-sm">{station.name}</h3>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {station.currentLoad} jobs
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{station.description}</p>

                  {/* Capacity Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Capacity</span>
                      <span className="font-medium">{station.assignedMembers.length}/{station.maxCapacity}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', utilization >= 1 ? 'bg-red-500' : utilization >= 0.5 ? 'bg-amber-500' : 'bg-emerald-500')}
                        style={{ width: `${Math.min(utilization * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Assigned Members */}
                  <div className="space-y-1.5">
                    {members.map(m => (
                      <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                        <Avatar className="w-7 h-7">
                          <AvatarFallback className="text-[10px] bg-blue-100 text-blue-700">{m.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{m.name}</p>
                          <p className="text-[10px] text-muted-foreground">{m.role}</p>
                        </div>
                        <Badge className={cn('text-[9px]', STATUS_COLORS[m.status])}>{m.status}</Badge>
                      </div>
                    ))}
                    {members.length === 0 && (
                      <div className="text-center py-3 text-xs text-muted-foreground border border-dashed rounded-lg">
                        No one assigned
                      </div>
                    )}
                  </div>

                  {station.assignedMembers.length < station.maxCapacity && (
                    <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1" onClick={() => toast.info('Select a team member to assign')}>
                      <UserPlus className="w-3 h-3" /> Add Member
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </SectionCard>

      {/* Unassigned Team Members */}
      {unassigned.length > 0 && (
        <SectionCard title="Available Team Members" subtitle="Not currently assigned to any station">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {unassigned.map(m => (
              <Card key={m.id} className="border shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-9 h-9">
                      <AvatarFallback className="text-xs bg-slate-100">{m.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.role}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {m.skills.map(s => (
                          <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-muted">{s}</span>
                        ))}
                      </div>
                    </div>
                    <Button size="sm" className="h-7 text-xs gap-1" onClick={() => { setAssignDialog({ memberId: m.id }); setSelectedStation(''); }}>
                      <ArrowRight className="w-3 h-3" /> Assign
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </SectionCard>
      )}

      {/* All Team Members */}
      <SectionCard title="Full Team Roster" subtitle="All team members and their current assignments">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 font-medium text-muted-foreground text-xs">Member</th>
                <th className="pb-2 font-medium text-muted-foreground text-xs">Role</th>
                <th className="pb-2 font-medium text-muted-foreground text-xs">Skills</th>
                <th className="pb-2 font-medium text-muted-foreground text-xs">Station</th>
                <th className="pb-2 font-medium text-muted-foreground text-xs">Status</th>
                <th className="pb-2 font-medium text-muted-foreground text-xs">Shifts</th>
              </tr>
            </thead>
            <tbody>
              {mockMembers.map(m => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-7 h-7">
                        <AvatarFallback className="text-[10px] bg-blue-100 text-blue-700">{m.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-xs">{m.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-xs text-muted-foreground">{m.role}</td>
                  <td className="py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {m.skills.map(s => <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-muted">{s}</span>)}
                    </div>
                  </td>
                  <td className="py-2.5 text-xs">{m.currentStation ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="py-2.5"><Badge className={cn('text-[10px]', STATUS_COLORS[m.status])}>{m.status.replace('_', ' ')}</Badge></td>
                  <td className="py-2.5 text-xs">{m.shiftsToday}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Assign Dialog */}
      <Dialog open={!!assignDialog} onOpenChange={() => setAssignDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign to Station</DialogTitle>
            <DialogDescription>
              Select a station for {assignDialog && mockMembers.find(m => m.id === assignDialog.memberId)?.name}
            </DialogDescription>
          </DialogHeader>
          <Select value={selectedStation} onValueChange={setSelectedStation}>
            <SelectTrigger>
              <SelectValue placeholder="Select station..." />
            </SelectTrigger>
            <SelectContent>
              {mockStations.filter(s => s.assignedMembers.length < s.maxCapacity).map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({s.assignedMembers.length}/{s.maxCapacity})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(null)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={!selectedStation}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
