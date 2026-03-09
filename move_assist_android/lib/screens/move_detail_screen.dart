import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import 'boxes_screen.dart';
import 'furniture_screen.dart';
import 'payment_screen.dart';

class MoveDetailScreen extends StatefulWidget {
  final String moveId;
  final String token;
  final String moveTitle;

  const MoveDetailScreen({
    super.key,
    required this.moveId,
    required this.token,
    required this.moveTitle,
  });

  @override
  State<MoveDetailScreen> createState() => _MoveDetailScreenState();
}

class _MoveDetailScreenState extends State<MoveDetailScreen> {
  MoveDetail? _detail;
  bool _loading = true;
  String? _error;
  bool _generatingPdf = false;

  @override
  void initState() {
    super.initState();
    _loadDetail();
  }

  Future<void> _loadDetail() async {
    setState(() { _loading = true; _error = null; });
    try {
      final detail = await MoveDetailService.getDetail(moveId: widget.moveId, token: widget.token);
      if (mounted) setState(() { _detail = detail; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString().replaceFirst('Exception: ', ''); _loading = false; });
    }
  }

  Future<void> _generatePdf() async {
    setState(() => _generatingPdf = true);
    try {
      final response = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/reports/generate/${widget.moveId}'),
        headers: {'Authorization': 'Bearer ${widget.token}'},
      );
      if (mounted) {
        if (response.statusCode == 200) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('PDF report generated successfully'),
              backgroundColor: Color(0xFF10b981),
            ),
          );
        } else {
          final err = jsonDecode(response.body) as Map<String, dynamic>;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(err['error'] ?? 'Failed to generate report'),
              backgroundColor: const Color(0xFFef4444),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: const Color(0xFFef4444)),
        );
      }
    } finally {
      if (mounted) setState(() => _generatingPdf = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFf6f7f8),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        shadowColor: const Color(0xFFe2e8f0),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: Color(0xFF0f1729)),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          widget.moveTitle,
          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF0f1729)),
        ),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, color: Color(0xFFe2e8f0)),
        ),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) return const Center(child: CircularProgressIndicator(color: Color(0xFF2563eb)));
    if (_error != null) return _ErrorState(message: _error!, onRetry: _loadDetail);
    final d = _detail!;
    return RefreshIndicator(
      onRefresh: _loadDetail,
      color: const Color(0xFF2563eb),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _HeaderCard(detail: d),
            const SizedBox(height: 16),
            _RouteCard(detail: d),
            const SizedBox(height: 16),
            _InfoCard(detail: d),
            const SizedBox(height: 16),
            _BoxTrackingCard(detail: d),
            const SizedBox(height: 16),
            _FinancialCard(detail: d),
            const SizedBox(height: 16),
            if (d.agentName != null) ...[
              _AgentCard(detail: d),
              const SizedBox(height: 16),
            ],
            _ActionsCard(
              detail: d,
              token: widget.token,
              onGeneratePdf: _generatePdf,
              generatingPdf: _generatingPdf,
            ),
          ],
        ),
      ),
    );
  }
}
class MoveDetail {
  final String id, title, fromAddress, toAddress, fromCity, toCity, status;
  final String? moveDate, quoteStatus, agentName, agentPhone, agentEmail, invoiceNumber;
  final int totalBoxes, deliveredBoxes, floorFrom, floorTo;
  final String paymentStatus, bhkType, createdAt;
  final double estimatedCost, tokenAmount, amountTotal, amountPaid, finalAmount;
  final bool tokenPaid, hasLiftFrom, hasLiftTo, rated;

  const MoveDetail({
    required this.id, required this.title, required this.fromAddress,
    required this.toAddress, required this.fromCity, required this.toCity,
    required this.status, this.moveDate, this.quoteStatus, this.agentName,
    this.agentPhone, this.agentEmail, this.invoiceNumber,
    required this.totalBoxes, required this.deliveredBoxes,
    required this.floorFrom, required this.floorTo,
    required this.paymentStatus, required this.bhkType, required this.createdAt,
    required this.estimatedCost, required this.tokenAmount,
    required this.amountTotal, required this.amountPaid, required this.finalAmount,
    required this.tokenPaid, required this.hasLiftFrom,
    required this.hasLiftTo, required this.rated,
  });

  factory MoveDetail.fromJson(Map<String, dynamic> j) => MoveDetail(
    id: j['id'].toString(),
    title: (j['title'] as String?)?.isNotEmpty == true ? j['title'] as String : 'Unnamed Move',
    fromAddress: (j['from_address'] as String?) ?? '—',
    toAddress: (j['to_address'] as String?) ?? '—',
    fromCity: (j['from_city'] as String?) ?? '—',
    toCity: (j['to_city'] as String?) ?? '—',
    status: (j['status'] as String?) ?? 'created',
    moveDate: j['move_date'] as String?,
    totalBoxes: int.tryParse(j['total_boxes']?.toString() ?? '0') ?? 0,
    deliveredBoxes: int.tryParse(j['delivered_boxes']?.toString() ?? '0') ?? 0,
    paymentStatus: (j['payment_status'] as String?) ?? 'pending',
    estimatedCost: double.tryParse(j['estimated_cost']?.toString() ?? '0') ?? 0,
    tokenAmount: double.tryParse(j['token_amount']?.toString() ?? '0') ?? 0,
    tokenPaid: (j['token_paid'] as bool?) ?? false,
    amountTotal: double.tryParse(j['amount_total']?.toString() ?? '0') ?? 0,
    amountPaid: double.tryParse(j['amount_paid']?.toString() ?? '0') ?? 0,
    finalAmount: double.tryParse(j['final_amount']?.toString() ?? '0') ?? 0,
    quoteStatus: j['quote_status'] as String?,
    bhkType: (j['bhk_type'] as String?) ?? '—',
    floorFrom: (j['floor_from'] as num?)?.toInt() ?? 0,
    floorTo: (j['floor_to'] as num?)?.toInt() ?? 0,
    hasLiftFrom: (j['has_lift_from'] as bool?) ?? false,
    hasLiftTo: (j['has_lift_to'] as bool?) ?? false,
    agentName: j['agent_name'] as String?,
    agentPhone: j['agent_phone'] as String?,
    agentEmail: j['agent_email'] as String?,
    invoiceNumber: j['invoice_number'] as String?,
    rated: (j['rated'] as bool?) ?? false,
    createdAt: (j['created_at'] as String?) ?? '',
  );
}

class MoveDetailService {
  static Future<MoveDetail> getDetail({ required String moveId, required String token }) async {
    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/moves/$moveId'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      return MoveDetail.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
    }
    final err = jsonDecode(response.body) as Map<String, dynamic>;
    throw Exception(err['error'] ?? 'Failed to load move detail');
  }
}

const _statusMap = {
  'planning': _SC(bg: Color(0xFFf1f5f9), fg: Color(0xFF64748b), label: 'Planning', icon: Icons.edit_note),
  'created': _SC(bg: Color(0xFFf1f5f9), fg: Color(0xFF64748b), label: 'Created', icon: Icons.add_circle_outline),
  'payment_pending': _SC(bg: Color(0xFFfef3c7), fg: Color(0xFFb45309), label: 'Payment Pending', icon: Icons.payment),
  'active': _SC(bg: Color(0xFFdbeafe), fg: Color(0xFF1d4ed8), label: 'Active', icon: Icons.local_shipping_outlined),
  'in_progress': _SC(bg: Color(0xFFfef3c7), fg: Color(0xFFb45309), label: 'In Progress', icon: Icons.loop),
  'completed': _SC(bg: Color(0xFFd1fae5), fg: Color(0xFF047857), label: 'Completed', icon: Icons.check_circle_outline),
};

class _SC {
  final Color bg, fg;
  final String label;
  final IconData icon;
  const _SC({required this.bg, required this.fg, required this.label, required this.icon});
}
class _HeaderCard extends StatelessWidget {
  final MoveDetail detail;
  const _HeaderCard({required this.detail});

  @override
  Widget build(BuildContext context) {
    final sc = _statusMap[detail.status] ?? const _SC(bg: Color(0xFFf1f5f9), fg: Color(0xFF64748b), label: 'Unknown', icon: Icons.info_outline);
    return _Card(
      child: Row(
        children: [
          Container(
            width: 48, height: 48,
            decoration: BoxDecoration(color: sc.bg, borderRadius: BorderRadius.circular(12)),
            child: Icon(sc.icon, color: sc.fg, size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(detail.title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF0f1729))),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  children: [
                    _Chip(label: sc.label, bg: sc.bg, fg: sc.fg),
                    _Chip(
                      label: _fmtStr(detail.paymentStatus),
                      bg: detail.paymentStatus == 'paid' ? const Color(0xFFd1fae5) : const Color(0xFFfef3c7),
                      fg: detail.paymentStatus == 'paid' ? const Color(0xFF047857) : const Color(0xFFb45309),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _fmtStr(String s) => s.replaceAll('_', ' ').split(' ').map((w) => w.isNotEmpty ? '${w[0].toUpperCase()}${w.substring(1)}' : w).join(' ');
}

class _RouteCard extends StatelessWidget {
  final MoveDetail detail;
  const _RouteCard({required this.detail});

  @override
  Widget build(BuildContext context) {
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle(title: 'Route', icon: Icons.map_outlined),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(child: _AddressBlock(label: 'FROM', city: detail.fromCity, address: detail.fromAddress, color: const Color(0xFF2563eb))),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Container(
                  width: 32, height: 32,
                  decoration: BoxDecoration(color: const Color(0xFFf1f5f9), borderRadius: BorderRadius.circular(8)),
                  child: const Icon(Icons.arrow_forward, size: 16, color: Color(0xFF64748b)),
                ),
              ),
              Expanded(child: _AddressBlock(label: 'TO', city: detail.toCity, address: detail.toAddress, color: const Color(0xFF10b981), alignEnd: true)),
            ],
          ),
          if (detail.moveDate != null) ...[
            const SizedBox(height: 14),
            const Divider(color: Color(0xFFf1f5f9), height: 1),
            const SizedBox(height: 14),
            Row(
              children: [
                const Icon(Icons.calendar_today_outlined, size: 14, color: Color(0xFF64748b)),
                const SizedBox(width: 6),
                Text('Move Date: ${_fmtDate(detail.moveDate!)}', style: const TextStyle(fontSize: 13, color: Color(0xFF64748b), fontWeight: FontWeight.w500)),
              ],
            ),
          ],
        ],
      ),
    );
  }

  String _fmtDate(String raw) {
    try {
      final dt = DateTime.parse(raw).toLocal();
      const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return '${m[dt.month - 1]} ${dt.day}, ${dt.year}';
    } catch (_) { return raw.split('T').first; }
  }
}

class _AddressBlock extends StatelessWidget {
  final String label, city, address;
  final Color color;
  final bool alignEnd;
  const _AddressBlock({required this.label, required this.city, required this.address, required this.color, this.alignEnd = false});

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: alignEnd ? CrossAxisAlignment.end : CrossAxisAlignment.start,
    children: [
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
        child: Text(label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: color, letterSpacing: 0.8)),
      ),
      const SizedBox(height: 4),
      Text(city, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0f1729)), textAlign: alignEnd ? TextAlign.end : TextAlign.start),
      const SizedBox(height: 2),
      Text(address, style: const TextStyle(fontSize: 11, color: Color(0xFF64748b)), maxLines: 2, overflow: TextOverflow.ellipsis, textAlign: alignEnd ? TextAlign.end : TextAlign.start),
    ],
  );
}
class _InfoCard extends StatelessWidget {
  final MoveDetail detail;
  const _InfoCard({required this.detail});

  @override
  Widget build(BuildContext context) => _Card(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionTitle(title: 'Move Details', icon: Icons.home_outlined),
        const SizedBox(height: 14),
        _InfoGrid(items: [
          _InfoItem(label: 'BHK Type', value: _fmtBhk(detail.bhkType), icon: Icons.apartment_outlined),
          _InfoItem(label: 'Floor (From)', value: 'Floor ${detail.floorFrom}', icon: Icons.stairs_outlined),
          _InfoItem(label: 'Floor (To)', value: 'Floor ${detail.floorTo}', icon: Icons.stairs),
          _InfoItem(label: 'Lift (From)', value: detail.hasLiftFrom ? 'Available' : 'Not Available', icon: detail.hasLiftFrom ? Icons.elevator : Icons.no_transfer, iconColor: detail.hasLiftFrom ? const Color(0xFF10b981) : const Color(0xFFef4444)),
          _InfoItem(label: 'Lift (To)', value: detail.hasLiftTo ? 'Available' : 'Not Available', icon: detail.hasLiftTo ? Icons.elevator : Icons.no_transfer, iconColor: detail.hasLiftTo ? const Color(0xFF10b981) : const Color(0xFFef4444)),
          if (detail.invoiceNumber != null) _InfoItem(label: 'Invoice', value: '#${detail.invoiceNumber}', icon: Icons.receipt_outlined),
        ]),
      ],
    ),
  );

  String _fmtBhk(String s) => s == 'studio' ? 'Studio' : s.replaceAll('_', ' ').toUpperCase();
}

class _InfoGrid extends StatelessWidget {
  final List<_InfoItem> items;
  const _InfoGrid({required this.items});

  @override
  Widget build(BuildContext context) => Wrap(
    spacing: 10, runSpacing: 10,
    children: items.map((item) => SizedBox(
      width: (MediaQuery.of(context).size.width - 72) / 2,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: const Color(0xFFf8fafc), border: Border.all(color: const Color(0xFFe2e8f0)), borderRadius: BorderRadius.circular(10)),
        child: Row(
          children: [
            Icon(item.icon, size: 16, color: item.iconColor ?? const Color(0xFF64748b)),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.label, style: const TextStyle(fontSize: 10, color: Color(0xFF94a3b8), fontWeight: FontWeight.w500)),
                  const SizedBox(height: 2),
                  Text(item.value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0f1729)), overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
          ],
        ),
      ),
    )).toList(),
  );
}

class _InfoItem {
  final String label, value;
  final IconData icon;
  final Color? iconColor;
  const _InfoItem({required this.label, required this.value, required this.icon, this.iconColor});
}

class _BoxTrackingCard extends StatelessWidget {
  final MoveDetail detail;
  const _BoxTrackingCard({required this.detail});

  @override
  Widget build(BuildContext context) {
    final total = detail.totalBoxes;
    final delivered = detail.deliveredBoxes;
    final progress = total > 0 ? delivered / total : 0.0;
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle(title: 'Box Tracking', icon: Icons.inventory_2_outlined),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('$delivered of $total boxes delivered', style: const TextStyle(fontSize: 13, color: Color(0xFF64748b), fontWeight: FontWeight.w500)),
                    const SizedBox(height: 8),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(99),
                      child: LinearProgressIndicator(
                        value: progress, minHeight: 8,
                        backgroundColor: const Color(0xFFe2e8f0),
                        valueColor: AlwaysStoppedAnimation<Color>(progress == 1.0 ? const Color(0xFF10b981) : const Color(0xFF2563eb)),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              Container(
                width: 56, height: 56,
                decoration: BoxDecoration(color: progress == 1.0 ? const Color(0xFFd1fae5) : const Color(0xFFeff6ff), shape: BoxShape.circle),
                child: Center(
                  child: Text('${(progress * 100).toInt()}%', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: progress == 1.0 ? const Color(0xFF047857) : const Color(0xFF2563eb))),
                ),
              ),
            ],
          ),
          if (total == 0) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: const Color(0xFFfef3c7), borderRadius: BorderRadius.circular(8)),
              child: const Row(
                children: [
                  Icon(Icons.info_outline, size: 14, color: Color(0xFFb45309)),
                  SizedBox(width: 6),
                  Text('No boxes added yet', style: TextStyle(fontSize: 12, color: Color(0xFFb45309), fontWeight: FontWeight.w500)),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
class _FinancialCard extends StatelessWidget {
  final MoveDetail detail;
  const _FinancialCard({required this.detail});

  @override
  Widget build(BuildContext context) => _Card(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionTitle(title: 'Payment Summary', icon: Icons.account_balance_wallet_outlined),
        const SizedBox(height: 14),
        _FinRow(label: 'Estimated Cost', value: detail.estimatedCost, isFirst: true),
        _FinRow(label: 'Token Amount', value: detail.tokenAmount, badge: detail.tokenPaid ? 'PAID' : null, badgeColor: const Color(0xFF10b981)),
        _FinRow(label: 'Final Amount', value: detail.finalAmount),
        _FinRow(label: 'Amount Paid', value: detail.amountPaid),
        const Divider(color: Color(0xFFe2e8f0), height: 20),
        _FinRow(
          label: 'Balance Due', value: detail.amountTotal - detail.amountPaid,
          isBold: true,
          valueColor: (detail.amountTotal - detail.amountPaid) > 0 ? const Color(0xFFef4444) : const Color(0xFF10b981),
        ),
      ],
    ),
  );
}

class _FinRow extends StatelessWidget {
  final String label;
  final double value;
  final String? badge;
  final Color? badgeColor, valueColor;
  final bool isBold, isFirst;

  const _FinRow({ required this.label, required this.value, this.badge, this.badgeColor, this.isBold = false, this.valueColor, this.isFirst = false });

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(top: isFirst ? 0 : 10),
    child: Row(
      children: [
        Expanded(child: Text(label, style: TextStyle(fontSize: 13, color: isBold ? const Color(0xFF0f1729) : const Color(0xFF64748b), fontWeight: isBold ? FontWeight.w700 : FontWeight.w500))),
        if (badge != null) ...[
          Container(
            margin: const EdgeInsets.only(right: 8),
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(color: badgeColor?.withOpacity(0.15), borderRadius: BorderRadius.circular(4)),
            child: Text(badge!, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: badgeColor, letterSpacing: 0.5)),
          ),
        ],
        Text(
          '₹${value.toStringAsFixed(2)}',
          style: TextStyle(fontSize: isBold ? 15 : 13, fontWeight: isBold ? FontWeight.w800 : FontWeight.w600, color: valueColor ?? const Color(0xFF0f1729)),
        ),
      ],
    ),
  );
}

class _AgentCard extends StatelessWidget {
  final MoveDetail detail;
  const _AgentCard({required this.detail});

  @override
  Widget build(BuildContext context) => _Card(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionTitle(title: 'Assigned Agent', icon: Icons.person_outline),
        const SizedBox(height: 14),
        Row(
          children: [
            Container(
              width: 44, height: 44,
              decoration: const BoxDecoration(color: Color(0xFF2563eb), shape: BoxShape.circle),
              child: Center(
                child: Text(
                  (detail.agentName ?? 'A').trim().split(' ').where((w) => w.isNotEmpty).map((w) => w[0].toUpperCase()).take(2).join(),
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(detail.agentName ?? '—', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0f1729))),
                  if (detail.agentPhone != null) ...[
                    const SizedBox(height: 2),
                    Row(children: [const Icon(Icons.phone_outlined, size: 12, color: Color(0xFF64748b)), const SizedBox(width: 4), Text(detail.agentPhone!, style: const TextStyle(fontSize: 12, color: Color(0xFF64748b)))]),
                  ],
                  if (detail.agentEmail != null) ...[
                    const SizedBox(height: 2),
                    Row(children: [const Icon(Icons.email_outlined, size: 12, color: Color(0xFF64748b)), const SizedBox(width: 4), Expanded(child: Text(detail.agentEmail!, style: const TextStyle(fontSize: 12, color: Color(0xFF64748b)), overflow: TextOverflow.ellipsis))]),
                  ],
                ],
              ),
            ),
          ],
        ),
      ],
    ),
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// Actions Card — Manage Boxes, Furniture, Payment & Invoice, Generate PDF Report
// ─────────────────────────────────────────────────────────────────────────────
class _ActionsCard extends StatelessWidget {
  final MoveDetail detail;
  final String token;
  final VoidCallback onGeneratePdf;
  final bool generatingPdf;

  const _ActionsCard({
    required this.detail,
    required this.token,
    required this.onGeneratePdf,
    required this.generatingPdf,
  });

  @override
  Widget build(BuildContext context) {
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle(title: 'Actions', icon: Icons.grid_view_outlined),
          const SizedBox(height: 14),
          // Manage Boxes
          _ActionTile(
            icon: Icons.inventory_2_outlined,
            iconColor: const Color(0xFF2563eb),
            iconBg: const Color(0xFFeff6ff),
            title: 'Manage Boxes',
            subtitle: '${detail.totalBoxes} box${detail.totalBoxes == 1 ? '' : 'es'} · ${detail.deliveredBoxes} delivered',
            badge: detail.totalBoxes > 0 ? '${detail.totalBoxes}' : null,
            onTap: () => Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => BoxesScreen(moveId: detail.id, token: token, moveTitle: detail.title),
            )),
          ),
          const _TileDivider(),
          // Furniture
          _ActionTile(
            icon: Icons.chair_outlined,
            iconColor: const Color(0xFF7c3aed),
            iconBg: const Color(0xFFf5f3ff),
            title: '${String.fromCharCode(0x1F6CB)} Furniture',
            subtitle: 'View and manage furniture items',
            onTap: () => Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => FurnitureScreen(moveId: detail.id, token: token, moveTitle: detail.title),
            )),
          ),
          const _TileDivider(),
          // Payment & Invoice
          _ActionTile(
            icon: Icons.credit_card_outlined,
            iconColor: const Color(0xFF10b981),
            iconBg: const Color(0xFFd1fae5),
            title: 'Payment & Invoice',
            subtitle: _paymentSubtitle(detail),
            onTap: () => Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => PaymentScreen(moveId: detail.id, token: token, moveTitle: detail.title),
            )),
          ),
          const SizedBox(height: 12),
          // Generate PDF Report — full-width blue button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: generatingPdf ? null : onGeneratePdf,
              icon: generatingPdf
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.picture_as_pdf_outlined, size: 18),
              label: Text(generatingPdf ? 'Generating...' : 'Generate PDF Report'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2563eb),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                elevation: 0,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _paymentSubtitle(MoveDetail d) {
    if (d.paymentStatus == 'paid') return 'Payment complete';
    if (d.tokenPaid) return 'Token paid · Balance pending';
    if (d.estimatedCost > 0) return 'Estimated: ₹${d.estimatedCost.toStringAsFixed(0)}';
    return 'Payment details';
  }
}

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final Color iconColor, iconBg;
  final String title, subtitle;
  final String? badge;
  final VoidCallback onTap;

  const _ActionTile({
    required this.icon,
    required this.iconColor,
    required this.iconBg,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.badge,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            Container(
              width: 44, height: 44,
              decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(12)),
              child: Icon(icon, size: 22, color: iconColor),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF0f1729))),
                  const SizedBox(height: 2),
                  Text(subtitle, style: const TextStyle(fontSize: 12, color: Color(0xFF64748b))),
                ],
              ),
            ),
            if (badge != null)
              Container(
                margin: const EdgeInsets.only(right: 6),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: iconColor.withOpacity(0.12), borderRadius: BorderRadius.circular(99)),
                child: Text(badge!, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: iconColor)),
              ),
            const Icon(Icons.chevron_right, size: 18, color: Color(0xFF94a3b8)),
          ],
        ),
      ),
    );
  }
}

class _TileDivider extends StatelessWidget {
  const _TileDivider();
  @override
  Widget build(BuildContext context) => const Divider(color: Color(0xFFf1f5f9), height: 1);
}
class _Card extends StatelessWidget {
  final Widget child;
  const _Card({required this.child});

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: Colors.white,
      border: Border.all(color: const Color(0xFFe2e8f0)),
      borderRadius: BorderRadius.circular(16),
      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 8, offset: const Offset(0, 2))],
    ),
    child: child,
  );
}

class _SectionTitle extends StatelessWidget {
  final String title;
  final IconData icon;
  const _SectionTitle({required this.title, required this.icon});

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(icon, size: 16, color: const Color(0xFF2563eb)),
      const SizedBox(width: 6),
      Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0f1729), letterSpacing: 0.1)),
    ],
  );
}

class _Chip extends StatelessWidget {
  final String label;
  final Color bg, fg;
  const _Chip({required this.label, required this.bg, required this.fg});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(99)),
    child: Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: fg)),
  );
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('⚠️', style: TextStyle(fontSize: 40)),
          const SizedBox(height: 12),
          Text(message, textAlign: TextAlign.center, style: const TextStyle(fontSize: 14, color: Color(0xFF64748b))),
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
