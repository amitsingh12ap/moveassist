import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';

// ─────────────────────────────────────────────────────────────────────────────
// FurnitureScreen — list & add furniture items for a move
// ─────────────────────────────────────────────────────────────────────────────

class FurnitureScreen extends StatefulWidget {
  final String moveId;
  final String token;
  final String moveTitle;

  const FurnitureScreen({
    super.key,
    required this.moveId,
    required this.token,
    required this.moveTitle,
  });

  @override
  State<FurnitureScreen> createState() => _FurnitureScreenState();
}

class _FurnitureScreenState extends State<FurnitureScreen> {
  List<FurnitureItem>? _items;
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
      final items = await FurnitureService.getItems(moveId: widget.moveId, token: widget.token);
      if (mounted) setState(() { _items = items; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString().replaceFirst('Exception: ', ''); _loading = false; });
    }
  }

  Future<void> _showAddSheet() async {
    final added = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AddFurnitureSheet(moveId: widget.moveId, token: widget.token),
    );
    if (added == true) _load();
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
            const Text('Furniture', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF0f1729))),
            Text(widget.moveTitle, style: const TextStyle(fontSize: 11, color: Color(0xFF64748b), fontWeight: FontWeight.w400)),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: TextButton.icon(
              onPressed: _showAddSheet,
              icon: const Icon(Icons.add, size: 16, color: Colors.white),
              label: const Text('+ Item', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700)),
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
      child: _items!.isEmpty
          ? ListView(children: const [SizedBox(height: 100), _EmptyFurniture()])
          : ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
              itemCount: _items!.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (_, i) => _FurnitureCard(item: _items![i]),
            ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FurnitureItem Model
// ─────────────────────────────────────────────────────────────────────────────

class FurnitureItem {
  final String id, moveId, name, category, conditionBefore;
  final String? conditionAfter, damageNotes, createdAt;

  const FurnitureItem({
    required this.id, required this.moveId, required this.name,
    required this.category, required this.conditionBefore,
    this.conditionAfter, this.damageNotes, this.createdAt,
  });

  factory FurnitureItem.fromJson(Map<String, dynamic> j) => FurnitureItem(
    id: j['id'].toString(),
    moveId: j['move_id'].toString(),
    name: (j['name'] as String?)?.isNotEmpty == true ? j['name'] as String : 'Unnamed Item',
    category: (j['category'] as String?) ?? 'Other',
    conditionBefore: (j['condition_before'] as String?) ?? 'unknown',
    conditionAfter: j['condition_after'] as String?,
    damageNotes: j['damage_notes'] as String?,
    createdAt: j['created_at'] as String?,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FurnitureService
// ─────────────────────────────────────────────────────────────────────────────

class FurnitureService {
  static Future<List<FurnitureItem>> getItems({required String moveId, required String token}) async {
    final r = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/furniture/move/$moveId'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (r.statusCode == 200) {
      return (jsonDecode(r.body) as List).map((f) => FurnitureItem.fromJson(f as Map<String, dynamic>)).toList();
    }
    throw Exception((jsonDecode(r.body) as Map<String, dynamic>)['error'] ?? 'Failed to load furniture');
  }

  static Future<FurnitureItem> addItem({
    required String moveId, required String token,
    required String name, required String category,
    required String conditionBefore, String? notes,
  }) async {
    final r = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/furniture/move/$moveId'),
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'},
      body: jsonEncode({
        'name': name, 'category': category, 'condition_before': conditionBefore,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
      }),
    );
    if (r.statusCode == 201 || r.statusCode == 200) {
      return FurnitureItem.fromJson(jsonDecode(r.body) as Map<String, dynamic>);
    }
    throw Exception((jsonDecode(r.body) as Map<String, dynamic>)['error'] ?? 'Failed to add furniture');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Furniture Card
// ─────────────────────────────────────────────────────────────────────────────

const _conditionConfig = {
  'excellent': _CC(bg: Color(0xFFd1fae5), fg: Color(0xFF047857), label: 'Excellent'),
  'good':      _CC(bg: Color(0xFFdbeafe), fg: Color(0xFF1d4ed8), label: 'Good'),
  'fair':      _CC(bg: Color(0xFFfef3c7), fg: Color(0xFFb45309), label: 'Fair'),
  'poor':      _CC(bg: Color(0xFFfee2e2), fg: Color(0xFFb91c1c), label: 'Poor'),
  'damaged':   _CC(bg: Color(0xFFfee2e2), fg: Color(0xFFb91c1c), label: 'Damaged'),
  'unknown':   _CC(bg: Color(0xFFf1f5f9), fg: Color(0xFF64748b), label: 'Unknown'),
};

class _CC {
  final Color bg, fg;
  final String label;
  const _CC({required this.bg, required this.fg, required this.label});
}

class _FurnitureCard extends StatelessWidget {
  final FurnitureItem item;
  const _FurnitureCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final before = _conditionConfig[item.conditionBefore] ??
        const _CC(bg: Color(0xFFf1f5f9), fg: Color(0xFF64748b), label: 'Unknown');
    final after = item.conditionAfter != null
        ? (_conditionConfig[item.conditionAfter!] ?? const _CC(bg: Color(0xFFf1f5f9), fg: Color(0xFF64748b), label: 'Unknown'))
        : null;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFe2e8f0)),
        borderRadius: BorderRadius.circular(14),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 6, offset: const Offset(0, 2))],
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40, height: 40,
                decoration: BoxDecoration(color: const Color(0xFFf0fdf4), borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.chair_outlined, color: Color(0xFF15803d), size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF0f1729))),
                    const SizedBox(height: 2),
                    Text(item.category, style: const TextStyle(fontSize: 11, color: Color(0xFF64748b))),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(color: Color(0xFFf1f5f9), height: 1),
          const SizedBox(height: 10),
          // Condition row
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('BEFORE', style: TextStyle(fontSize: 9, color: Color(0xFF94a3b8), fontWeight: FontWeight.w700, letterSpacing: 0.8)),
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: before.bg, borderRadius: BorderRadius.circular(6)),
                      child: Text(before.label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: before.fg)),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.arrow_forward, size: 14, color: Color(0xFF94a3b8)),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text('AFTER', style: TextStyle(fontSize: 9, color: Color(0xFF94a3b8), fontWeight: FontWeight.w700, letterSpacing: 0.8)),
                    const SizedBox(height: 4),
                    after != null
                        ? Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(color: after.bg, borderRadius: BorderRadius.circular(6)),
                            child: Text(after.label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: after.fg)),
                          )
                        : Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(color: const Color(0xFFf1f5f9), borderRadius: BorderRadius.circular(6)),
                            child: const Text('Pending', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF94a3b8))),
                          ),
                  ],
                ),
              ),
            ],
          ),
          if (item.damageNotes != null && item.damageNotes!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: const Color(0xFFfef2f2), borderRadius: BorderRadius.circular(6)),
              child: Row(
                children: [
                  const Icon(Icons.warning_amber_outlined, size: 12, color: Color(0xFFef4444)),
                  const SizedBox(width: 6),
                  Expanded(child: Text(item.damageNotes!, style: const TextStyle(fontSize: 11, color: Color(0xFFb91c1c)))),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Furniture Bottom Sheet
// ─────────────────────────────────────────────────────────────────────────────

class _AddFurnitureSheet extends StatefulWidget {
  final String moveId, token;
  const _AddFurnitureSheet({required this.moveId, required this.token});

  @override
  State<_AddFurnitureSheet> createState() => _AddFurnitureSheetState();
}

class _AddFurnitureSheetState extends State<_AddFurnitureSheet> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  String _category = 'Living Room';
  String _condition = 'good';
  bool _saving = false;
  String? _error;

  static const _categories = ['Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 'Dining Room', 'Office', 'Storage', 'Other'];
  static const _conditions = ['excellent', 'good', 'fair', 'poor', 'damaged'];

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() { _saving = true; _error = null; });
    try {
      await FurnitureService.addItem(
        moveId: widget.moveId, token: widget.token,
        name: _nameCtrl.text.trim(), category: _category,
        conditionBefore: _condition,
        notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) setState(() { _error = e.toString().replaceFirst('Exception: ', ''); _saving = false; });
    }
  }

  @override
  void dispose() { _nameCtrl.dispose(); _notesCtrl.dispose(); super.dispose(); }

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
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(child: Container(width: 36, height: 4, decoration: BoxDecoration(color: const Color(0xFFe2e8f0), borderRadius: BorderRadius.circular(2)))),
                const SizedBox(height: 16),
                const Text('Add Furniture', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF0f1729))),
                const SizedBox(height: 20),
                _FieldLabel(text: 'ITEM NAME'),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _nameCtrl,
                  decoration: _inputDec(hint: 'e.g. Sofa, Dining Table'),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Name is required' : null,
                ),
                const SizedBox(height: 14),
                _FieldLabel(text: 'CATEGORY'),
                const SizedBox(height: 6),
                DropdownButtonFormField<String>(
                  value: _category,
                  decoration: _inputDec(hint: ''),
                  items: _categories.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                  onChanged: (v) => setState(() => _category = v ?? _category),
                ),
                const SizedBox(height: 14),
                _FieldLabel(text: 'CONDITION BEFORE MOVE'),
                const SizedBox(height: 8),
                // Condition chips
                Wrap(
                  spacing: 8, runSpacing: 8,
                  children: _conditions.map((c) {
                    final selected = _condition == c;
                    final cc = _conditionConfig[c] ?? const _CC(bg: Color(0xFFf1f5f9), fg: Color(0xFF64748b), label: '');
                    return GestureDetector(
                      onTap: () => setState(() => _condition = c),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: selected ? cc.bg : const Color(0xFFf8fafc),
                          border: Border.all(color: selected ? cc.fg : const Color(0xFFe2e8f0), width: selected ? 1.5 : 1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          '${c[0].toUpperCase()}${c.substring(1)}',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: selected ? cc.fg : const Color(0xFF64748b)),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 14),
                _FieldLabel(text: 'NOTES (OPTIONAL)'),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _notesCtrl,
                  decoration: _inputDec(hint: 'Any details about the item...'),
                  maxLines: 2,
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
                        : const Text('Add Furniture Item', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ),
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

class _EmptyFurniture extends StatelessWidget {
  const _EmptyFurniture();
  @override
  Widget build(BuildContext context) => const Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Text('🛋', style: TextStyle(fontSize: 52)),
      SizedBox(height: 12),
      Text('No furniture yet', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF0f1729))),
      SizedBox(height: 4),
      Text('Document items before the move', style: TextStyle(fontSize: 13, color: Color(0xFF64748b))),
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
