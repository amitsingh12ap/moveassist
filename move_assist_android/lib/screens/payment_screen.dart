import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';

// ─────────────────────────────────────────────────────────────────────────────
// PaymentScreen
// ─────────────────────────────────────────────────────────────────────────────
class PaymentScreen extends StatefulWidget {
  final String moveId;
  final String token;
  final String moveTitle;

  const PaymentScreen({
    super.key,
    required this.moveId,
    required this.token,
    required this.moveTitle,
  });

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  PaymentDetail? _detail;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final d = await PaymentService.getDetail(moveId: widget.moveId, token: widget.token);
      if (mounted) setState(() { _detail = d; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString().replaceFirst('Exception: ', ''); _loading = false; });
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
        title: const Text(
          'Payment & Invoice',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF0f1729)),
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
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF2563eb)));
    }
    if (_error != null) {
      return _ErrorState(message: _error!, onRetry: _load);
    }
    final d = _detail!;
    return RefreshIndicator(
      onRefresh: _load,
      color: const Color(0xFF2563eb),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _TitleRow(detail: d),
            const SizedBox(height: 20),
            _PaymentStepper(detail: d),
            const SizedBox(height: 16),
            _StatusMessageCard(detail: d),
            const SizedBox(height: 16),
            _PaymentSummaryCard(detail: d),
            if (d.invoiceNumber != null) ...[
              const SizedBox(height: 16),
              _InvoiceCard(detail: d),
            ],
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PaymentDetail Model
// ─────────────────────────────────────────────────────────────────────────────
class PaymentDetail {
  final String id, title, status, paymentStatus;
  final double estimatedCost, tokenAmount, amountTotal, amountPaid, finalAmount;
  final bool tokenPaid;
  final String? quoteStatus, invoiceNumber, tokenPaidAt;

  const PaymentDetail({
    required this.id,
    required this.title,
    required this.status,
    required this.paymentStatus,
    required this.estimatedCost,
    required this.tokenAmount,
    required this.amountTotal,
    required this.amountPaid,
    required this.finalAmount,
    required this.tokenPaid,
    this.quoteStatus,
    this.invoiceNumber,
    this.tokenPaidAt,
  });

  factory PaymentDetail.fromJson(Map<String, dynamic> j) => PaymentDetail(
    id: j['id'].toString(),
    title: (j['title'] as String?)?.isNotEmpty == true ? j['title'] as String : 'Move',
    status: (j['status'] as String?) ?? 'created',
    paymentStatus: (j['payment_status'] as String?) ?? 'pending',
    estimatedCost: double.tryParse(j['estimated_cost']?.toString() ?? '0') ?? 0,
    tokenAmount: double.tryParse(j['token_amount']?.toString() ?? '0') ?? 0,
    tokenPaid: (j['token_paid'] as bool?) ?? false,
    amountTotal: double.tryParse(j['amount_total']?.toString() ?? '0') ?? 0,
    amountPaid: double.tryParse(j['amount_paid']?.toString() ?? '0') ?? 0,
    finalAmount: double.tryParse(j['final_amount']?.toString() ?? '0') ?? 0,
    quoteStatus: j['quote_status'] as String?,
    invoiceNumber: j['invoice_number'] as String?,
    tokenPaidAt: j['token_paid_at'] as String?,
  );

  int get currentStep {
    if (status == 'in_progress') return 5;
    if (paymentStatus == 'paid') return 4;
    if (quoteStatus == 'final') return 3;
    if (status == 'active') return 2;
    if (tokenPaid) return 1;
    if (estimatedCost > 0) return 0;
    return -1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PaymentService
// ─────────────────────────────────────────────────────────────────────────────
class PaymentService {
  static Future<PaymentDetail> getDetail({
    required String moveId,
    required String token,
  }) async {
    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/moves/$moveId'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      return PaymentDetail.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
    }
    final err = jsonDecode(response.body) as Map<String, dynamic>;
    throw Exception(err['error'] ?? 'Failed to load payment details');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step Configuration
// ─────────────────────────────────────────────────────────────────────────────
class _StepConfig {
  final String label;
  final IconData icon;
  const _StepConfig({required this.label, required this.icon});
}

const _steps = [
  _StepConfig(label: 'Price Set', icon: Icons.price_check),
  _StepConfig(label: 'Token Paid', icon: Icons.payments_outlined),
  _StepConfig(label: 'Move Active', icon: Icons.check_circle_outline),
  _StepConfig(label: 'Final Quote', icon: Icons.receipt_long_outlined),
  _StepConfig(label: 'Balance Paid', icon: Icons.account_balance_wallet_outlined),
  _StepConfig(label: 'In Progress', icon: Icons.local_shipping_outlined),
];

// ─────────────────────────────────────────────────────────────────────────────
// Title Row
// ─────────────────────────────────────────────────────────────────────────────
class _TitleRow extends StatelessWidget {
  final PaymentDetail detail;
  const _TitleRow({required this.detail});

  @override
  Widget build(BuildContext context) {
    final invoiceLabel = detail.invoiceNumber != null
        ? 'Invoice #${detail.invoiceNumber}'
        : 'Invoice pending';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          detail.title,
          style: const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w800,
            color: Color(0xFF0f1729),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          invoiceLabel,
          style: const TextStyle(fontSize: 13, color: Color(0xFF64748b)),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment Stepper
// ─────────────────────────────────────────────────────────────────────────────
class _PaymentStepper extends StatelessWidget {
  final PaymentDetail detail;
  const _PaymentStepper({required this.detail});

  @override
  Widget build(BuildContext context) {
    final current = detail.currentStep;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFe2e8f0)),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(_steps.length, (i) {
            final isCompleted = i < current;
            final isActive = i == current;
            final isLast = i == _steps.length - 1;

            return Row(
              children: [
                _StepNode(
                  step: i + 1,
                  label: _steps[i].label,
                  icon: _steps[i].icon,
                  isCompleted: isCompleted,
                  isActive: isActive,
                ),
                if (!isLast)
                  Container(
                    width: 28,
                    height: 2,
                    margin: const EdgeInsets.only(bottom: 18),
                    color: isCompleted ? const Color(0xFF2563eb) : const Color(0xFFe2e8f0),
                  ),
              ],
            );
          }),
        ),
      ),
    );
  }
}

class _StepNode extends StatelessWidget {
  final int step;
  final String label;
  final IconData icon;
  final bool isCompleted, isActive;

  const _StepNode({
    required this.step,
    required this.label,
    required this.icon,
    required this.isCompleted,
    required this.isActive,
  });

  @override
  Widget build(BuildContext context) {
    Color circleBg;
    Color circleFg;
    Color labelColor;

    if (isCompleted) {
      circleBg = const Color(0xFF2563eb);
      circleFg = Colors.white;
      labelColor = const Color(0xFF2563eb);
    } else if (isActive) {
      circleBg = const Color(0xFF2563eb);
      circleFg = Colors.white;
      labelColor = const Color(0xFF0f1729);
    } else {
      circleBg = const Color(0xFFe2e8f0);
      circleFg = const Color(0xFF94a3b8);
      labelColor = const Color(0xFF94a3b8);
    }

    return SizedBox(
      width: 60,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: circleBg, shape: BoxShape.circle),
            child: isCompleted
                ? Icon(Icons.check, size: 18, color: circleFg)
                : Icon(icon, size: 18, color: circleFg),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 9,
              fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
              color: labelColor,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Message Card
// ─────────────────────────────────────────────────────────────────────────────
class _StatusMessageCard extends StatelessWidget {
  final PaymentDetail detail;
  const _StatusMessageCard({required this.detail});

  @override
  Widget build(BuildContext context) {
    final info = _getStatusInfo(detail);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: info.bg,
        border: Border.all(color: info.border),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: info.iconBg, borderRadius: BorderRadius.circular(8)),
            child: Icon(info.icon, size: 20, color: info.iconColor),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  info.title,
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: info.titleColor),
                ),
                const SizedBox(height: 2),
                Text(info.message, style: const TextStyle(fontSize: 12, color: Color(0xFF64748b))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  _StatusInfo _getStatusInfo(PaymentDetail d) {
    switch (d.currentStep) {
      case 5:
        return _StatusInfo(
          bg: const Color(0xFFfef3c7), border: const Color(0xFFfde68a),
          iconBg: const Color(0xFFfde68a), icon: Icons.local_shipping_outlined,
          iconColor: const Color(0xFFb45309), title: 'In Progress',
          titleColor: const Color(0xFFb45309),
          message: 'Your move is currently in progress.',
        );
      case 4:
        return _StatusInfo(
          bg: const Color(0xFFd1fae5), border: const Color(0xFF6ee7b7),
          iconBg: const Color(0xFF6ee7b7), icon: Icons.check_circle_outline,
          iconColor: const Color(0xFF047857), title: 'Payment Complete',
          titleColor: const Color(0xFF047857),
          message: 'All payments have been settled.',
        );
      case 3:
        return _StatusInfo(
          bg: const Color(0xFFeff6ff), border: const Color(0xFFbfdbfe),
          iconBg: const Color(0xFFbfdbfe), icon: Icons.receipt_long_outlined,
          iconColor: const Color(0xFF1d4ed8), title: 'Final Quote Ready',
          titleColor: const Color(0xFF1d4ed8),
          message: 'Final quote has been set. Please review and pay the balance.',
        );
      case 2:
        return _StatusInfo(
          bg: const Color(0xFFd1fae5), border: const Color(0xFF6ee7b7),
          iconBg: const Color(0xFF6ee7b7), icon: Icons.check_circle_outline,
          iconColor: const Color(0xFF047857), title: 'Active',
          titleColor: const Color(0xFF047857),
          message: 'Move activated! Agent will visit soon to assess items and provide final quote.',
        );
      case 1:
        return _StatusInfo(
          bg: const Color(0xFFd1fae5), border: const Color(0xFF6ee7b7),
          iconBg: const Color(0xFF6ee7b7), icon: Icons.payments_outlined,
          iconColor: const Color(0xFF047857), title: 'Token Paid',
          titleColor: const Color(0xFF047857),
          message: 'Token payment received. Your move is confirmed.',
        );
      case 0:
        return _StatusInfo(
          bg: const Color(0xFFfef3c7), border: const Color(0xFFfde68a),
          iconBg: const Color(0xFFfde68a), icon: Icons.price_check,
          iconColor: const Color(0xFFb45309), title: 'Price Set',
          titleColor: const Color(0xFFb45309),
          message: 'Estimated price has been set. Please pay the token amount to activate your move.',
        );
      default:
        return _StatusInfo(
          bg: const Color(0xFFf1f5f9), border: const Color(0xFFe2e8f0),
          iconBg: const Color(0xFFe2e8f0), icon: Icons.info_outline,
          iconColor: const Color(0xFF64748b), title: 'Payment Pending',
          titleColor: const Color(0xFF0f1729),
          message: 'Your move is being set up. Payment details will be available soon.',
        );
    }
  }
}

class _StatusInfo {
  final Color bg, border, iconBg, iconColor, titleColor;
  final IconData icon;
  final String title, message;
  const _StatusInfo({
    required this.bg, required this.border, required this.iconBg,
    required this.icon, required this.iconColor,
    required this.title, required this.titleColor, required this.message,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment Summary Card
// ─────────────────────────────────────────────────────────────────────────────
class _PaymentSummaryCard extends StatelessWidget {
  final PaymentDetail detail;
  const _PaymentSummaryCard({required this.detail});

  @override
  Widget build(BuildContext context) {
    final balance = detail.amountTotal - detail.amountPaid;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFe2e8f0)),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 8, offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.account_balance_wallet_outlined, size: 16, color: Color(0xFF2563eb)),
              SizedBox(width: 6),
              Text(
                'Payment Summary',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0f1729), letterSpacing: 0.1),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _SummaryRow(label: 'Estimated Cost', value: detail.estimatedCost, isFirst: true),
          _SummaryRow(
            label: 'Token Amount',
            value: detail.tokenAmount,
            badge: detail.tokenPaid ? 'PAID' : 'PENDING',
            badgeColor: detail.tokenPaid ? const Color(0xFF10b981) : const Color(0xFFb45309),
          ),
          if (detail.finalAmount > 0)
            _SummaryRow(label: 'Final Amount', value: detail.finalAmount),
          _SummaryRow(label: 'Amount Paid', value: detail.amountPaid),
          const Divider(color: Color(0xFFe2e8f0), height: 20),
          _SummaryRow(
            label: 'Balance Due',
            value: balance,
            isBold: true,
            valueColor: balance > 0 ? const Color(0xFFef4444) : const Color(0xFF10b981),
          ),
        ],
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final double value;
  final String? badge;
  final Color? badgeColor, valueColor;
  final bool isBold, isFirst;

  const _SummaryRow({
    required this.label,
    required this.value,
    this.badge,
    this.badgeColor,
    this.isBold = false,
    this.valueColor,
    this.isFirst = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(top: isFirst ? 0 : 10),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13,
                color: isBold ? const Color(0xFF0f1729) : const Color(0xFF64748b),
                fontWeight: isBold ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ),
          if (badge != null) ...[
            Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: badgeColor?.withOpacity(0.12),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                badge!,
                style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: badgeColor, letterSpacing: 0.5),
              ),
            ),
          ],
          Text(
            '₹${value.toStringAsFixed(2)}',
            style: TextStyle(
              fontSize: isBold ? 15 : 13,
              fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
              color: valueColor ?? const Color(0xFF0f1729),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Invoice Card
// ─────────────────────────────────────────────────────────────────────────────
class _InvoiceCard extends StatelessWidget {
  final PaymentDetail detail;
  const _InvoiceCard({required this.detail});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFe2e8f0)),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 8, offset: const Offset(0, 2)),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: const Color(0xFFeff6ff),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.receipt_outlined, size: 22, color: Color(0xFF2563eb)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Invoice',
                  style: TextStyle(fontSize: 11, color: Color(0xFF94a3b8), fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 2),
                Text(
                  '#${detail.invoiceNumber}',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0f1729)),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: Color(0xFF94a3b8)),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Error State
// ─────────────────────────────────────────────────────────────────────────────
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
