import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';

// ─────────────────────────────────────────────────────────────────────────────
// BoxesScreen — list all boxes for a move, add new boxes, view QR codes
// ─────────────────────────────────────────────────────────────────────────────

class BoxesScreen extends StatefulWidget {
  final String moveId;
  final String token;
  final String moveTitle;

  const BoxesScreen({
    super.key,
    required this.moveId,
    required this.token,
    required this.moveTitle,
  });

  @override
  State<BoxesScreen> createState() => _BoxesScreenState();
}

class _BoxesScreenState extends State<BoxesScreen> {
  List<MoveBox>? _boxes;
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
      final boxes = await BoxService.getBoxes(moveId: widget.moveId, token: widget.token);
      if (mounted) setState(() { _boxes = boxes; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString().replaceFirst('Exception: ', ''); _loading = false; });
    }
  }

  Future<void> _showAddBoxSheet() async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AddBoxSheet(moveId: widget.moveId, token: widget.token),
    );
    if (created == true) _load();
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
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Boxes', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF0f1729))),
            Text(widget.moveTitle, style: const TextStyle(fontSize: 11, color: Color(0xFF64748b), fontWeight: FontWeight.w400)),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: TextButton.icon(
              onPressed: _showAddBoxSheet,
              icon: const Icon(Icons.add, size: 16, color: Colors.white),
              label: const Text('+ Box', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700)),
              style: TextButton.styleFrom(
                backgroundColor: const Color(0xFF2563eb),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ),
        ],
        bottom: const PreferredSize(preferredSize: Size.fromHeight(1), child: Divider(height: 1, color: Color(0xFFe2e8f0))),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) return const Center(child: CircularProgressIndicator(color: Color(0xFF2563eb)));
    if (_error != null) return _ErrorState(message: _error!, onRetry: _load);

    return RefreshIndicator(
      onRefresh: _load,
      color: const Color(0xFF2563eb),
      child: _boxes!.isEmpty
          ? ListView(
              children: const [
                SizedBox(height: 100),
                _EmptyBoxes(),
              ],
            )
          : ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
              itemCount: _boxes!.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (_, i) => _BoxCard(box: _boxes![i]),
            ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Box Model
// ─────────────────────────────────────────────────────────────────────────────

class MoveBox {
  final String id, moveId, qrCode, label, category, status;
  final String? contents, qrImageUrl;
  final String createdAt;

  const MoveBox({
    required this.id, required this.moveId, required this.qrCode,
    required this.label, required this.category, required this.status,
    this.contents, this.qrImageUrl, required this.createdAt,
  });

  factory MoveBox.fromJson(Map<String, dynamic> j) => MoveBox(
    id: j['id'].toString(),
    moveId: j['move_id'].toString(),
    qrCode: j['qr_code']?.toString() ?? '',
    label: (j['label'] as String?)?.isNotEmpty == true ? j['label'] as String : 'Unnamed Box',
    category: (j['category'] as String?) ?? 'General',
    status: (j['status'] as String?) ?? 'created',
    contents: j['contents'] as String?,
    qrImageUrl: j['qr_image_url'] as String?,
    createdAt: (j['created_at'] as String?) ?? '',
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BoxService
// ─────────────────────────────────────────────────────────────────────────────

class BoxService {
  static Future<List<MoveBox>> getBoxes({required String moveId, required String token}) async {
    final r = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/boxes/move/$moveId'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (r.statusCode == 200) {
      return (jsonDecode(r.body) as List).map((b) => MoveBox.fromJson(b as Map<String, dynamic>)).toList();
    }
    throw Exception((jsonDecode(r.body) as Map<String, dynamic>)['error'] ?? 'Failed to load boxes');
  }

  static Future<MoveBox> createBox({
    required String moveId, required String token,
    required String label, required String category, String? contents,
  }) async {
    final r = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/boxes/move/$moveId'),
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'},
      body: jsonEncode({'label': label, 'category': category, if (contents != null && contents.isNotEmpty) 'contents': contents}),
    );
    if (r.statusCode == 201 || r.statusCode == 200) {
      return MoveBox.fromJson(jsonDecode(r.body) as Map<String, dynamic>);
    }
    throw Exception((jsonDecode(r.body) as Map<String, dynamic>)['error'] ?? 'Failed to create box');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Box Card
// ─────────────────────────────────────────────────────────────────────────────

const _boxStatusConfig = {
  'created':     _BSC(bg: Color(0xFFf1f5f9), fg: Color(0xFF64748b), label: 'Created',     icon: Icons.add_box_outlined),
  'packed':      _BSC(bg: Color(0xFFfef3c7), fg: Color(0xFFb45309), label: 'Packed',      icon: Icons.inventory_outlined),
  'loaded':      _BSC(bg: Color(0xFFdbeafe), fg: Color(0xFF1d4ed8), label: 'Loaded',      icon: Icons.local_shipping_outlined),
  'in_transit':  _BSC(bg: Color(0xFFede9fe), fg: Color(0xFF7c3aed), label: 'In Transit',  icon: Icons.directions_car_outlined),
  'delivered':   _BSC(bg: Color(0xFFd1fae5), fg: Color(0xFF047857), label: 'Delivered',   icon: Icons.check_circle_outline),
};

class _BSC {
  final Color bg, fg;
  final String label;
  final IconData icon;
  const _BSC({required this.bg, required this.fg, required this.label, required this.icon});
}

class _BoxCard extends StatelessWidget {
  final MoveBox box;
  const _BoxCard({required this.box});

  @override
  Widget build(BuildContext context) {
    final sc = _boxStatusConfig[box.status] ??
        const _BSC(bg: Color(0xFFf1f5f9), fg: Color(0xFF64748b), label: 'Unknown', icon: Icons.help_outline);
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFe2e8f0)),
        borderRadius: BorderRadius.circular(14),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 6, offset: const Offset(0, 2))],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => _showQr(context),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                // Category icon
                Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(color: const Color(0xFFeff6ff), borderRadius: BorderRadius.circular(10)),
                  child: const Icon(Icons.inventory_2_outlined, color: Color(0xFF2563eb), size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(child: Text(box.label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF0f1729)))),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                            decoration: BoxDecoration(color: sc.bg, borderRadius: BorderRadius.circular(99)),
                            child: Text(sc.label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: sc.fg)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(children: [
                        Icon(sc.icon, size: 12, color: const Color(0xFF94a3b8)),
                        const SizedBox(width: 4),
                        Text(box.category, style: const TextStyle(fontSize: 11, color: Color(0xFF64748b))),
                        if (box.contents != null && box.contents!.isNotEmpty) ...[
                          const Text(' · ', style: TextStyle(color: Color(0xFF94a3b8))),
                          Expanded(child: Text(box.contents!, style: const TextStyle(fontSize: 11, color: Color(0xFF94a3b8)), overflow: TextOverflow.ellipsis)),
                        ],
                      ]),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                const Icon(Icons.qr_code_2, color: Color(0xFF94a3b8), size: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showQr(BuildContext context) {
    if (box.qrImageUrl == null || box.qrImageUrl!.isEmpty) return;
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(box.label, style: const TextStyle(fontWeight: FontWeight.w700)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Display base64 QR image
            Image.memory(
              _base64ToBytes(box.qrImageUrl!),
              width: 200, height: 200,
              fit: BoxFit.contain,
            ),
            const SizedBox(height: 12),
            Text('QR: ${box.qrCode.split('-').first}...', style: const TextStyle(fontSize: 11, color: Color(0xFF94a3b8))),
            const SizedBox(height: 4),
            Text('Status: ${box.status}', style: const TextStyle(fontSize: 12, color: Color(0xFF64748b))),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close')),
        ],
      ),
    );
  }

  Uint8List _base64ToBytes(String dataUrl) {
    final b64 = dataUrl.contains(',') ? dataUrl.split(',').last : dataUrl;
    return base64Decode(b64);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Box Bottom Sheet
// ─────────────────────────────────────────────────────────────────────────────

class _AddBoxSheet extends StatefulWidget {
  final String moveId, token;
  const _AddBoxSheet({required this.moveId, required this.token});

  @override
  State<_AddBoxSheet> createState() => _AddBoxSheetState();
}

class _AddBoxSheetState extends State<_AddBoxSheet> {
  final _formKey = GlobalKey<FormState>();
  final _labelCtrl = TextEditingController();
  final _contentsCtrl = TextEditingController();
  String _category = 'General';
  bool _saving = false;
  String? _error;

  static const _categories = [
    'General', 'Kitchen', 'Bedroom', 'Bathroom', 'Living Room',
    'Electronics', 'Books', 'Clothes', 'Fragile', 'Tools',
  ];

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() { _saving = true; _error = null; });
    try {
      await BoxService.createBox(
        moveId: widget.moveId, token: widget.token,
        label: _labelCtrl.text.trim(), category: _category,
        contents: _contentsCtrl.text.trim().isEmpty ? null : _contentsCtrl.text.trim(),
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) setState(() { _error = e.toString().replaceFirst('Exception: ', ''); _saving = false; });
    }
  }

  @override
  void dispose() { _labelCtrl.dispose(); _contentsCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Handle bar
              Center(child: Container(width: 36, height: 4, decoration: BoxDecoration(color: const Color(0xFFe2e8f0), borderRadius: BorderRadius.circular(2)))),
              const SizedBox(height: 16),
              const Text('Add Box', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF0f1729))),
              const SizedBox(height: 20),
              // Label
              _FieldLabel(text: 'LABEL'),
              const SizedBox(height: 6),
              TextFormField(
                controller: _labelCtrl,
                decoration: _inputDec(hint: 'e.g. Kitchen Essentials'),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Label is required' : null,
              ),
              const SizedBox(height: 14),
              // Category
              _FieldLabel(text: 'CATEGORY'),
              const SizedBox(height: 6),
              DropdownButtonFormField<String>(
                value: _category,
                decoration: _inputDec(hint: ''),
                items: _categories.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                onChanged: (v) => setState(() => _category = v ?? _category),
              ),
              const SizedBox(height: 14),
              // Contents
              _FieldLabel(text: 'CONTENTS'),
              const SizedBox(height: 6),
              TextFormField(
                controller: _contentsCtrl,
                decoration: _inputDec(hint: "What's inside this box?"),
                maxLines: 3,
                minLines: 2,
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: Color(0xFFef4444), fontSize: 12)),
              ],
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _saving ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563eb),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    elevation: 0,
                  ),
                  child: _saving
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text('Add Box + Generate QR', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDec({required String hint}) => InputDecoration(
    hintText: hint,
    hintStyle: const TextStyle(color: Color(0xFF94a3b8)),
    filled: true,
    fillColor: const Color(0xFFf8fafc),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFe2e8f0))),
    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFe2e8f0))),
    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFF2563eb), width: 1.5)),
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
  );
}

class _FieldLabel extends StatelessWidget {
  final String text;
  const _FieldLabel({required this.text});
  @override
  Widget build(BuildContext context) => Text(text, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748b), letterSpacing: 0.8));
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty / Error States
// ─────────────────────────────────────────────────────────────────────────────

class _EmptyBoxes extends StatelessWidget {
  const _EmptyBoxes();
  @override
  Widget build(BuildContext context) => const Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Text('📦', style: TextStyle(fontSize: 52)),
      SizedBox(height: 12),
      Text('No boxes yet', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF0f1729))),
      SizedBox(height: 4),
      Text('Tap + Box to add your first', style: TextStyle(fontSize: 13, color: Color(0xFF64748b))),
    ],
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
          TextButton(onPressed: onRetry, child: const Text('Try again', style: TextStyle(color: Color(0xFF2563eb), fontWeight: FontWeight.w700))),
        ],
      ),
    ),
  );
}
