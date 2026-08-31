'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import CollapsibleSection from '@/components/CollapsibleSection';
import { ABILITY_LEVEL_LABELS, type AbilityLevel } from '@/lib/registration';
import { suggestPlaceholderAlias } from '@/lib/placeholderAlias';
import SwitchPlaceholderControl from '@/components/SwitchPlaceholderControl';

type Division = {
  id: string;
  name: string;
  division_order: number;
  max_players: number;
  league_type: string;
  status: string;
};
type Registration = {
  id: string;
  player_id: string;
  full_name: string;
  ability_level: AbilityLevel;
  answers: Record<string, string>;
};
type Player = {
  id: string;
  full_name: string;
  is_placeholder: boolean;
  placeholder_alias: string | null;
  placeholder_anonymized: boolean;
  is_unverified: boolean;
};
type Draft = { league_id: string; player_id: string; partner_id: string | null; confirmed: boolean };
type BoardPlayer = {
  player_id: string;
  full_name: string;
  ability_level: AbilityLevel | null;
  is_placeholder: boolean;
  is_unverified: boolean;
};

function boardPlayerFor(playerId: string, playerById: Map<string, Player>, registrationByPlayer: Map<string, Registration>): BoardPlayer | undefined {
  const player = playerById.get(playerId);
  const registration = registrationByPlayer.get(playerId);
  if (!player && !registration) return undefined;
  return {
    player_id: playerId,
    full_name: player?.full_name ?? registration?.full_name ?? 'Unknown',
    ability_level: registration?.ability_level ?? null,
    is_placeholder: player?.is_placeholder ?? false,
    is_unverified: player?.is_unverified ?? false,
  };
}

function playersInDivision(
  drafts: Draft[],
  playerById: Map<string, Player>,
  registrationByPlayer: Map<string, Registration>,
  leagueId: string
): BoardPlayer[] {
  return drafts
    .filter((d) => d.league_id === leagueId)
    .map((d) => boardPlayerFor(d.player_id, playerById, registrationByPlayer))
    .filter((p): p is BoardPlayer => !!p);
}

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Exports only what's currently drafted into a division - unassigned registrants have no
 * allocation yet, so they're left out, same as the board itself. A plain reference table
 * (not meant to be re-imported) so someone can mark up proposed moves in a spreadsheet.
 */
export function buildAllocationsCsv(
  divisions: Division[],
  drafts: Draft[],
  playerById: Map<string, Player>,
  registrationByPlayer: Map<string, Registration>
): string {
  const rows: string[][] = [['Division', 'Player', 'Type', 'Ability Level', 'Partner']];
  for (const division of divisions) {
    const entries = drafts
      .filter((d) => d.league_id === division.id)
      .map((d) => ({ draft: d, player: boardPlayerFor(d.player_id, playerById, registrationByPlayer) }))
      .filter((e): e is { draft: Draft; player: BoardPlayer } => !!e.player)
      .sort((a, b) => a.player.full_name.localeCompare(b.player.full_name));
    for (const { draft, player } of entries) {
      const partner = draft.partner_id ? boardPlayerFor(draft.partner_id, playerById, registrationByPlayer) : undefined;
      rows.push([
        division.name,
        player.full_name,
        player.is_placeholder ? 'Placeholder' : 'Member',
        player.ability_level ? ABILITY_LEVEL_LABELS[player.ability_level] ?? player.ability_level : '',
        partner?.full_name ?? '',
      ]);
    }
  }
  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

/** Lowercased tournament name with filesystem-unsafe characters stripped, for use in a download filename. */
export function filenameSafeName(name: string): string {
  return name.toLowerCase().replace(/[\\/:*?"<>|]/g, '').trim();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

/**
 * One display line per player drafted into a division, for the PDF export - doubles pairs
 * collapse onto a single "A / B" line instead of appearing twice (once per side of the pair).
 */
export function divisionEntryLines(
  division: Division,
  drafts: Draft[],
  playerById: Map<string, Player>,
  registrationByPlayer: Map<string, Registration>
): string[] {
  const boardPlayers = playersInDivision(drafts, playerById, registrationByPlayer, division.id)
    .slice()
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const player of boardPlayers) {
    if (seen.has(player.player_id)) continue;
    seen.add(player.player_id);
    const draft = drafts.find((d) => d.league_id === division.id && d.player_id === player.player_id);
    const partner = draft?.partner_id ? boardPlayerFor(draft.partner_id, playerById, registrationByPlayer) : undefined;
    if (partner) seen.add(partner.player_id);
    lines.push(partner ? `${player.full_name} / ${partner.full_name}` : player.full_name);
  }
  return lines;
}

function PlayerCard({
  player,
  leagueId,
  divisions,
  draftByPlayer,
  playerById,
  registrationByPlayer,
  drafts,
  busy,
  draggingId,
  setDraggingId,
  move,
  pair,
  realMembers,
  reload,
}: {
  player: BoardPlayer;
  leagueId: string | null;
  divisions: Division[];
  draftByPlayer: Map<string, Draft>;
  playerById: Map<string, Player>;
  registrationByPlayer: Map<string, Registration>;
  drafts: Draft[];
  busy: boolean;
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
  move: (playerId: string, targetLeagueId: string | null, opts?: { silent?: boolean }) => Promise<void>;
  pair: (leagueId: string, p1Id: string, p2Id: string | null) => void;
  realMembers: { id: string; full_name: string }[];
  reload: () => Promise<void>;
}) {
  const draft = draftByPlayer.get(player.player_id);
  const division = leagueId ? divisions.find((d) => d.id === leagueId) : undefined;
  const isDoubles = division?.league_type === 'doubles';
  const partner = draft?.partner_id ? boardPlayerFor(draft.partner_id, playerById, registrationByPlayer) : undefined;
  const unpairedInColumn = leagueId
    ? playersInDivision(drafts, playerById, registrationByPlayer, leagueId).filter(
        (p) => p.player_id !== player.player_id && !draftByPlayer.get(p.player_id)?.partner_id
      )
    : [];

  return (
    <div
      draggable={!busy}
      onDragStart={() => setDraggingId(player.player_id)}
      onDragEnd={() => setDraggingId(null)}
      className={`bg-white border border-gray-200 rounded-lg p-2.5 space-y-1.5 cursor-move ${draggingId === player.player_id ? 'opacity-40' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-800 truncate">{player.full_name}</span>
        {draft?.confirmed && (
          <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium bg-green-100 text-green-700">Confirmed</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {player.ability_level && (
          <span className="inline-block text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
            {ABILITY_LEVEL_LABELS[player.ability_level] ?? player.ability_level}
          </span>
        )}
        {player.is_placeholder && (
          <span className="inline-block text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">Placeholder</span>
        )}
        {!player.ability_level && !player.is_placeholder && (
          <span className="inline-block text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">Not registered</span>
        )}
        {player.is_unverified && (
          <span className="inline-block text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-medium">Unverified</span>
        )}
        {player.is_placeholder && (
          <div className="ml-auto">
            <SwitchPlaceholderControl
              placeholderId={player.player_id}
              placeholderFullName={player.full_name}
              realMembers={realMembers}
              onSwapped={() => { reload(); }}
              triggerClassName="inline-block text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium hover:bg-indigo-100"
            />
          </div>
        )}
      </div>

      {isDoubles && leagueId && (
        partner ? (
          <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
            <span>+ {partner.full_name}</span>
            <button type="button" onClick={() => pair(leagueId, player.player_id, null)} disabled={busy}
              className="text-red-500 hover:text-red-700 hover:underline disabled:opacity-40">
              Unpair
            </button>
          </div>
        ) : (
          <select
            aria-label={`Pair ${player.full_name} with`}
            value=""
            onChange={(e) => e.target.value && pair(leagueId, player.player_id, e.target.value)}
            disabled={busy || unpairedInColumn.length === 0}
            className="w-full text-xs px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-40"
          >
            <option value="">Pair with...</option>
            {unpairedInColumn.map((p) => (
              <option key={p.player_id} value={p.player_id}>{p.full_name}</option>
            ))}
          </select>
        )
      )}

      <select
        aria-label={`Move ${player.full_name} to`}
        value={leagueId ?? ''}
        onChange={(e) => { move(player.player_id, e.target.value || null).catch(() => {}); }}
        disabled={busy}
        className="w-full text-xs px-2 py-1 rounded border border-gray-300 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-40"
      >
        <option value="">Unassigned</option>
        {divisions.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>
    </div>
  );
}

function AddPlayerPicker({
  leagueId,
  players,
  divisions,
  draftByPlayer,
  registrationByPlayer,
  busy,
  move,
}: {
  leagueId: string;
  players: Player[];
  divisions: Division[];
  draftByPlayer: Map<string, Draft>;
  registrationByPlayer: Map<string, Registration>;
  busy: boolean;
  move: (playerId: string, targetLeagueId: string | null, opts?: { silent?: boolean }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [fullName, setFullName] = useState('');
  const [alias, setAlias] = useState('');
  const [anonymized, setAnonymized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState('');

  function close() {
    setOpen(false);
    setSearch('');
    setCreating(false);
    setFullName('');
    setAlias('');
    setAnonymized(false);
    setCreateError('');
  }

  function openCreate() {
    setAlias(suggestPlaceholderAlias(players.filter((p) => p.is_placeholder).map((p) => p.placeholder_alias)));
    setCreateError('');
    setCreating(true);
  }

  async function handleCreate() {
    if (!fullName.trim()) return;
    if (anonymized && !alias.trim()) {
      setCreateError('An alias is required when anonymizing this placeholder');
      return;
    }
    setSaving(true);
    setCreateError('');
    try {
      const res = await fetch('/api/admin/placeholder-players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: fullName.trim(), alias: alias.trim() || null, anonymized }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create placeholder');
      await move(data.id, leagueId, { silent: true });
      close();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} disabled={busy}
        className="w-full text-xs text-green-700 hover:text-green-900 font-medium hover:underline py-1 disabled:opacity-40">
        + Add player
      </button>
    );
  }

  if (creating) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 space-y-1.5">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">New placeholder player</p>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Full name"
          autoFocus
          disabled={saving}
          className="w-full text-xs px-2 py-1.5 rounded border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-40"
        />
        <input
          type="text"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder="Alias (shown when anonymized)"
          disabled={saving}
          className="w-full text-xs px-2 py-1.5 rounded border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-40"
        />
        <label className="flex items-center gap-2 text-xs text-gray-700">
          <input type="checkbox" checked={anonymized} onChange={(e) => setAnonymized(e.target.checked)} disabled={saving} className="accent-green-700 w-3.5 h-3.5" />
          Anonymize - show the alias everywhere instead of the full name
        </label>
        {createError && <p className="text-xs text-red-600">{createError}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={() => setCreating(false)} disabled={saving}
            className="flex-1 text-xs border border-gray-300 hover:border-gray-400 text-gray-600 font-medium py-1.5 rounded-lg transition-colors disabled:opacity-40">
            Back
          </button>
          <button type="button" onClick={handleCreate} disabled={saving || !fullName.trim()}
            className="flex-1 text-xs bg-green-700 hover:bg-green-800 disabled:opacity-40 text-white font-medium py-1.5 rounded-lg transition-colors">
            {saving ? 'Adding...' : 'Add to division'}
          </button>
        </div>
      </div>
    );
  }

  const candidates = players
    .filter((p) => draftByPlayer.get(p.id)?.league_id !== leagueId)
    .filter((p) => p.full_name.toLowerCase().includes(search.toLowerCase()));

  function statusFor(p: Player): string | null {
    const draft = draftByPlayer.get(p.id);
    if (draft) {
      const division = divisions.find((d) => d.id === draft.league_id);
      return `in ${division?.name ?? 'another division'}`;
    }
    if (registrationByPlayer.has(p.id)) return 'unassigned - registered';
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2 space-y-1.5">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search..."
        autoFocus
        className="w-full text-xs px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      <div className="max-h-40 overflow-y-auto divide-y divide-gray-100">
        {candidates.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-2">No matches</p>
        ) : (
          candidates.map((p) => {
            const status = statusFor(p);
            return (
              <button key={p.id} type="button" disabled={busy}
                onClick={() => { move(p.id, leagueId).catch(() => {}); close(); }}
                className="w-full text-left px-1 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-40"
              >
                <span className="text-gray-700">{p.full_name}</span>
                {p.is_placeholder && (
                  <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">Placeholder</span>
                )}
                {p.is_unverified && (
                  <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">Unverified</span>
                )}
                {status && <span className="ml-1.5 text-gray-400">({status})</span>}
              </button>
            );
          })
        )}
      </div>
      <button type="button" onClick={openCreate} disabled={busy}
        className="w-full text-xs text-green-700 hover:text-green-900 font-medium hover:underline py-1 disabled:opacity-40">
        + Create new placeholder
      </button>
      <button type="button" onClick={close} className="w-full text-xs text-gray-500 hover:text-gray-700 py-1">
        Cancel
      </button>
    </div>
  );
}

function Column({
  title,
  leagueId,
  meta,
  boardPlayers,
  divisions,
  draftByPlayer,
  playerById,
  registrationByPlayer,
  drafts,
  players,
  busy,
  draggingId,
  setDraggingId,
  move,
  pair,
  onDrop,
  realMembers,
  reload,
}: {
  title: string;
  leagueId: string | null;
  meta?: string;
  boardPlayers: BoardPlayer[];
  divisions: Division[];
  draftByPlayer: Map<string, Draft>;
  playerById: Map<string, Player>;
  registrationByPlayer: Map<string, Registration>;
  drafts: Draft[];
  players: Player[];
  busy: boolean;
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
  move: (playerId: string, targetLeagueId: string | null, opts?: { silent?: boolean }) => Promise<void>;
  pair: (leagueId: string, p1Id: string, p2Id: string | null) => void;
  onDrop: (targetLeagueId: string | null) => void;
  realMembers: { id: string; full_name: string }[];
  reload: () => Promise<void>;
}) {
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDrop(leagueId)}
      className="shrink-0 w-56 bg-gray-50 border border-gray-200 rounded-lg flex flex-col"
    >
      <div className="px-3 py-2 border-b border-gray-200">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide truncate">{title}</p>
        {meta && <p className="text-xs text-gray-400">{meta}</p>}
      </div>
      <div className="p-2 space-y-2 min-h-[60px]">
        {boardPlayers.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3">Drop players here</p>
        ) : (
          boardPlayers.map((p) => (
            <PlayerCard
              key={p.player_id}
              player={p}
              leagueId={leagueId}
              divisions={divisions}
              draftByPlayer={draftByPlayer}
              playerById={playerById}
              registrationByPlayer={registrationByPlayer}
              drafts={drafts}
              busy={busy}
              draggingId={draggingId}
              setDraggingId={setDraggingId}
              move={move}
              pair={pair}
              realMembers={realMembers}
              reload={reload}
            />
          ))
        )}
        {leagueId && (
          <AddPlayerPicker
            leagueId={leagueId}
            players={players}
            divisions={divisions}
            draftByPlayer={draftByPlayer}
            registrationByPlayer={registrationByPlayer}
            busy={busy}
            move={move}
          />
        )}
      </div>
    </div>
  );
}

export default function AssignDivisionsPanel({ tournamentId, tournamentName }: { tournamentId: string; tournamentName: string }) {
  const router = useRouter();
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<Draft[] | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/assign-divisions`);
      const data = await res.json();
      if (res.ok) {
        setDivisions(data.divisions);
        setRegistrations(data.registrations);
        setPlayers(data.players);
        setDrafts(data.drafts);
      }
      setLoading(false);
    }
    load();
  }, [tournamentId]);

  async function reload() {
    const res = await fetch(`/api/admin/tournaments/${tournamentId}/assign-divisions`);
    const data = await res.json();
    if (res.ok) {
      setDivisions(data.divisions);
      setRegistrations(data.registrations);
      setPlayers(data.players);
      setDrafts(data.drafts);
    }
    router.refresh();
  }

  const registrationByPlayer = new Map(registrations.map((r) => [r.player_id, r]));
  const playerById = new Map(players.map((p) => [p.id, p]));
  const realMembers = players.filter((p) => !p.is_placeholder);
  const draftByPlayer = new Map(drafts.map((d) => [d.player_id, d]));
  const unassigned = registrations.filter((r) => !draftByPlayer.has(r.player_id));
  const unassignedBoardPlayers: BoardPlayer[] = unassigned.map((r) => ({
    player_id: r.player_id,
    full_name: r.full_name,
    ability_level: r.ability_level,
    is_placeholder: false,
    is_unverified: false,
  }));

  async function move(playerId: string, targetLeagueId: string | null, opts?: { silent?: boolean }) {
    setUndoSnapshot(null);
    setBusy(true);
    if (!opts?.silent) setError('');
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/assign-divisions/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, targetLeagueId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to move player');
      await reload();
    } catch (e) {
      if (!opts?.silent) setError(e instanceof Error ? e.message : 'Something went wrong');
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function pair(leagueId: string, p1Id: string, p2Id: string | null) {
    setUndoSnapshot(null);
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/assign-divisions/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId, p1Id, p2Id }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update pairing');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function suggest() {
    if (drafts.length > 0 && !window.confirm('This replaces the current arrangement with a fresh auto-suggested one - any manual moves will be lost. Continue?')) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/assign-divisions/suggest`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to suggest an allocation');
      setUndoSnapshot(data.previousDrafts ?? []);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function undoSuggest() {
    if (!undoSnapshot) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/assign-divisions/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drafts: undoSnapshot }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to undo');
      setUndoSnapshot(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function confirmChoices() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/assign-divisions/confirm`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to confirm');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const csv = buildAllocationsCsv(divisions, drafts, playerById, registrationByPlayer);
    // Leading UTF-8 BOM so Excel detects the encoding correctly instead of guessing.
    const BOM = '﻿';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `league-allocations-${filenameSafeName(tournamentName)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function exportPdf() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 8;
    const marginBottom = 6;
    // Below the logo (top 6mm + 16mm tall = bottom at 22mm) with clear breathing room, since the
    // rightmost grid column sits directly underneath it.
    const headerHeight = 32;
    const columnGap = 6;
    const rowGap = 10;
    const lineHeight = 4.5;
    const headingGap = 4;

    // Wide, shallow grid - at most 5 divisions per row (wrapping into further rows beyond that)
    // so each column gets real width and player names fit on one line, rather than cramming
    // every division into a single ever-narrower row.
    const columnsPerRow = Math.min(divisions.length, 5) || 1;
    const columnWidth = (pageWidth - marginX * 2) / columnsPerRow;
    const textWidth = columnWidth - columnGap;

    // Each row's height comes from its tallest division's actual content, not an even split of
    // the whole page - otherwise a row of small divisions leaves a huge gap before the next row.
    function divisionContentHeight(division: Division): number {
      doc.setFontSize(9);
      const nameLines: string[] = doc.splitTextToSize(division.name, textWidth);
      let height = nameLines.length * lineHeight + headingGap;
      doc.setFontSize(8);
      for (const line of divisionEntryLines(division, drafts, playerById, registrationByPlayer)) {
        const wrapped: string[] = doc.splitTextToSize(line, textWidth);
        height += wrapped.length * lineHeight;
      }
      return height;
    }
    const divisionHeights = divisions.map(divisionContentHeight);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(tournamentName, marginX, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('League Allocations', marginX, 19);

    try {
      const logo = await loadImage('/qptc-logo.jpg');
      const logoSize = 16;
      doc.addImage(logo, 'JPEG', pageWidth - marginX - logoSize, 6, logoSize, logoSize);
    } catch {
      // The logo is a nice-to-have - still produce the PDF if it fails to load.
    }

    let rowTop = headerHeight;
    divisions.forEach((division, i) => {
      const col = i % columnsPerRow;
      if (i > 0 && col === 0) {
        // Starting a new row - advance past the tallest division in the row just finished.
        const previousRowHeights = divisionHeights.slice(i - columnsPerRow, i);
        rowTop += Math.max(...previousRowHeights) + rowGap;
      }
      const x = marginX + col * columnWidth;
      let y = rowTop;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      const nameLines = doc.splitTextToSize(division.name, textWidth);
      doc.text(nameLines, x, y);
      y += nameLines.length * lineHeight;
      doc.setDrawColor(180);
      doc.line(x, y, x + textWidth, y);
      y += headingGap;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      for (const line of divisionEntryLines(division, drafts, playerById, registrationByPlayer)) {
        const wrapped: string[] = doc.splitTextToSize(line, textWidth);
        for (const wrappedLine of wrapped) {
          if (y > pageHeight - marginBottom) break;
          doc.text(wrappedLine, x, y);
          y += lineHeight;
        }
      }
    });

    doc.save(`league-allocations-${filenameSafeName(tournamentName)}.pdf`);
  }

  function handleDrop(targetLeagueId: string | null) {
    if (!draggingId || busy) return;
    const playerId = draggingId;
    setDraggingId(null);
    if (draftByPlayer.get(playerId)?.league_id === targetLeagueId) return;
    move(playerId, targetLeagueId).catch(() => {});
  }

  if (loading) {
    return (
      <CollapsibleSection title="Assign divisions" defaultOpen>
        <p className="text-sm text-gray-400 py-1">Loading...</p>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      title="Assign divisions"
      defaultOpen
      meta={<span className="text-xs text-gray-400">Hidden from members until the round starts</span>}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {unassigned.length > 0 && (
            <button type="button" onClick={suggest} disabled={busy}
              className="text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium px-3 py-2 rounded-lg transition-colors">
              Auto-suggest allocation
            </button>
          )}
          {undoSnapshot && (
            <button type="button" onClick={undoSuggest} disabled={busy}
              className="text-sm border border-gray-300 hover:border-gray-400 text-gray-700 font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-40">
              Undo auto-allocate
            </button>
          )}
          <button type="button" onClick={confirmChoices} disabled={busy || drafts.length === 0}
            className="text-sm bg-green-700 hover:bg-green-800 disabled:opacity-40 text-white font-medium px-3 py-2 rounded-lg transition-colors">
            Confirm choices
          </button>
          <button type="button" onClick={exportCsv} disabled={drafts.length === 0}
            className="text-sm border border-gray-300 hover:border-gray-400 text-gray-700 font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-40">
            Export as CSV
          </button>
          <button type="button" onClick={() => { exportPdf().catch(() => {}); }} disabled={drafts.length === 0}
            className="text-sm border border-gray-300 hover:border-gray-400 text-gray-700 font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-40">
            Download PDF
          </button>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <div className="flex gap-3 overflow-x-auto pb-2">
          {unassigned.length > 0 && (
            <Column
              title="Unassigned" leagueId={null} meta={`${unassigned.length} pending`}
              boardPlayers={unassignedBoardPlayers} divisions={divisions} draftByPlayer={draftByPlayer}
              playerById={playerById} registrationByPlayer={registrationByPlayer} drafts={drafts} players={players}
              busy={busy} draggingId={draggingId} setDraggingId={setDraggingId} move={move} pair={pair} onDrop={handleDrop}
              realMembers={realMembers} reload={reload}
            />
          )}
          {divisions.map((d) => {
            const boardPlayers = playersInDivision(drafts, playerById, registrationByPlayer, d.id);
            return (
              <Column
                key={d.id}
                title={d.name} leagueId={d.id} meta={`${boardPlayers.length} / ${d.max_players}`}
                boardPlayers={boardPlayers} divisions={divisions} draftByPlayer={draftByPlayer}
                playerById={playerById} registrationByPlayer={registrationByPlayer} drafts={drafts} players={players}
                busy={busy} draggingId={draggingId} setDraggingId={setDraggingId} move={move} pair={pair} onDrop={handleDrop}
                realMembers={realMembers} reload={reload}
              />
            );
          })}
        </div>
      </div>
    </CollapsibleSection>
  );
}
