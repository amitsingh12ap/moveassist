import 'package:flutter/material.dart';
import '../../models/move.dart';
import '../../services/moves_service.dart';
import '../create_move_screen.dart';

class MovesTab extends StatefulWidget {
  final String token;
  const MovesTab({super.key, required this.token});

  @override
  State<MovesTab> createState() => _MovesTabState();
}

class _MovesTabState extends State<MovesTab> {
  List<Move>? _moves;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadMoves();
  }

  Future<void> _loadMoves() async {
    setState(() { _loading = true; _error = null; });
    try {
      final moves = await MovesService.getMoves(widget.token);
      if (mounted) setState(() { _moves = moves; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString().replaceFirst('Exception: ', ''); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _loadMoves,
      color: const Color(0xFF2563eb),
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          // Header
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
              child: Row(
                children: [
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'My Moves',
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0f1729),
                            letterSpacing: -0.3,
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'All your home shifting projects',
                          style: TextStyle(fontSize: 13, color: Color(0xFF64748b)),
                        ),
                      ],
                    ),
                  ),
                  _NewMoveButton(token: widget.token, onCreated: _loadMoves),
                ],
              ),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 20)),
          // Body
          if (_loading)
            const SliverFillRemaining(
              child: Center(
                child: CircularProgressIndicator(color: Color(0xFF2563eb)),
              ),
            )
          else if (_error != null)
            SliverFillRemaining(
              child: _ErrorState(message: _error!, onRetry: _loadMoves),
            )
          else if (_moves!.isEmpty)
            const SliverFillRemaining(child: _EmptyState())
          else ...[
            // Stats row
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: _StatsRow(moves: _moves!),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 16)),
            // Move cards
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (ctx, i) => _MoveCard(move: _moves![i]),
                  childCount: _moves!.length,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ── New Move Button ──────────────────────────────────────────────
class _NewMoveButton extends StatelessWidget {
  final String token;
  final VoidCallback onCreated;

  const _NewMoveButton({required this.token, required this.onCreated});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => CreateMoveScreen(token: token, onMoveCreated: onCreated),
        ),
      ),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: const Color(0xFF2563eb),
          borderRadius: BorderRadius.circular(10),
        ),
        child: const Row(
          children: [
            Icon(Icons.add, color: Colors.white, size: 14),
            SizedBox(width: 4),
            Text(
              'New Move',
              style: TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Stats Row ────────────────────────────────────────────────────
class _StatsRow extends StatelessWidget {
  final List<Move> moves;
  const _StatsRow({required this.moves});

  @override
  Widget build(BuildContext context) {
    final total = moves.length;
    final active = moves.where((m) => m.status == 'active' || m.status == 'in_progress').length;
    final done = moves.where((m) => m.status == 'completed').length;

    return Row(
      children: [
        Expanded(child: _StatCard(value: '$total', label: 'Total Moves', iconBg: const Color(0xFFeff6ff), iconColor: const Color(0xFF2563eb), icon: Icons.home_outlined)),
        const SizedBox(width: 10),
        Expanded(child: _StatCard(value: '$active', label: 'In Progress', iconBg: const Color(0xFFfef3c7), iconColor: const Color(0xFFb45309), icon: Icons.local_shipping_outlined)),
        const SizedBox(width: 10),
        Expanded(child: _StatCard(value: '$done', label: 'Completed', iconBg: const Color(0xFFdcfce7), iconColor: const Color(0xFF15803d), icon: Icons.check_circle_outline)),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  final String value;
  final String label;
  final Color iconBg;
  final Color iconColor;
  final IconData icon;

  const _StatCard({
    required this.value,
    required this.label,
    required this.iconBg,
    required this.iconColor,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFe2e8f0)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(8)),
            child: Icon(icon, color: iconColor, size: 16),
          ),
          const SizedBox(height: 8),
          Text(value,
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: iconColor, height: 1)),
          const SizedBox(height: 3),
          Text(label,
              style: const TextStyle(fontSize: 10, color: Color(0xFF64748b), fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}

// ── Move Card ────────────────────────────────────────────────────
class _MoveCard extends StatelessWidget {
  final Move move;
  const _MoveCard({required this.move});

  static const _statusConfig = {
    'planning':        (_StatCfg(bg: Color(0xFFf1f5f9), fg: Color(0xFF64748b), label: 'Planning')),
    'created':         (_StatCfg(bg: Color(0xFFf1f5f9), fg: Color(0xFF64748b), label: 'Created')),
    'payment_pending': (_StatCfg(bg: Color(0xFFfef3c7), fg: Color(0xFFb45309), label: 'Payment Pending')),
    'active':          (_StatCfg(bg: Color(0xFFdbeafe), fg: Color(0xFF1d4ed8), label: 'Active')),
    'in_progress':     (_StatCfg(bg: Color(0xFFfef3c7), fg: Color(0xFFb45309), label: 'In Progress')),
    'completed':       (_StatCfg(bg: Color(0xFFd1fae5), fg: Color(0xFF047857), label: 'Completed')),
  };

  static const _borderColors = {
    'active':          Color(0xFF22c55e),
    'in_progress':     Color(0xFFf59e0b),
    'completed':       Color(0xFF6366f1),
    'payment_pending': Color(0xFFf59e0b),
  };

  @override
  Widget build(BuildContext context) {
    final cfg = _statusConfig[move.status] ?? const _StatCfg(bg: Color(0xFFf1f5f9), fg: Color(0xFF64748b), label: 'Unknown');
    final leftBorder = _borderColors[move.status] ?? const Color(0xFFe2e8f0);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFe2e8f0)),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          )
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(15),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () {}, // TODO: navigate to move detail
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Colored left accent strip
                  Container(width: 4, color: leftBorder),
                  // Card content
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Header row
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Text(
                                  move.title,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 15,
                                    color: Color(0xFF0f1729),
                                    height: 1.3,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: cfg.bg,
                                  borderRadius: BorderRadius.circular(99),
                                ),
                                child: Text(
                                  cfg.label,
                                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: cfg.fg),
                                ),
                              ),
                            ],
                          ),
                          // Route
                          if (move.fromAddress != null || move.toAddress != null) ...[
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    move.fromAddress ?? '—',
                                    style: const TextStyle(fontSize: 12, color: Color(0xFF64748b)),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                const Padding(
                                  padding: EdgeInsets.symmetric(horizontal: 6),
                                  child: Icon(Icons.arrow_forward, size: 14, color: Color(0xFF94a3b8)),
                                ),
                                Expanded(
                                  child: Text(
                                    move.toAddress ?? '—',
                                    style: const TextStyle(fontSize: 12, color: Color(0xFF64748b)),
                                    overflow: TextOverflow.ellipsis,
                                    textAlign: TextAlign.end,
                                  ),
                                ),
                              ],
                            ),
                          ],
                          const SizedBox(height: 10),
                          // Footer
                          Row(
                            children: [
                              const Icon(Icons.inventory_2_outlined, size: 12, color: Color(0xFF64748b)),
                              const SizedBox(width: 4),
                              Text(
                                '${move.deliveredBoxes}/${move.totalBoxes} boxes',
                                style: const TextStyle(fontSize: 11, color: Color(0xFF64748b)),
                              ),
                              const Spacer(),
                              Text(
                                _formatDate(move.moveDate ?? move.createdAt),
                                style: const TextStyle(fontSize: 11, color: Color(0xFF94a3b8)),
                              ),
                            ],
                          ), // footer Row
                        ],
                      ), // Column
                    ), // Padding
                  ), // Expanded
                ],
              ), // horizontal Row
            ), // IntrinsicHeight
          ), // InkWell
        ), // Material
      ), // ClipRRect
    );
  }

  String _formatDate(String raw) {
    if (raw.isEmpty) return '—';
    try {
      final dt = DateTime.parse(raw).toLocal();
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return '${months[dt.month - 1]} ${dt.day}, ${dt.year}';
    } catch (_) {
      return raw.split('T').first;
    }
  }
}

class _StatCfg {
  final Color bg;
  final Color fg;
  final String label;
  const _StatCfg({required this.bg, required this.fg, required this.label});
}

// ── Empty / Error States ─────────────────────────────────────────
class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('🏠', style: TextStyle(fontSize: 48)),
          SizedBox(height: 12),
          Text('No moves yet',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF0f1729))),
          SizedBox(height: 4),
          Text('Tap + New Move to get started',
              style: TextStyle(fontSize: 13, color: Color(0xFF64748b))),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('⚠️', style: TextStyle(fontSize: 40)),
            const SizedBox(height: 12),
            Text(message,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 14, color: Color(0xFF64748b))),
            const SizedBox(height: 20),
            TextButton(
              onPressed: onRetry,
              child: const Text('Try again', style: TextStyle(color: Color(0xFF2563eb), fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
    );
  }
}