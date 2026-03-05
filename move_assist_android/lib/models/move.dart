class Move {
  final String id;
  final String title;
  final String? fromAddress;
  final String? toAddress;
  final String status;
  final String? moveDate;
  final int totalBoxes;
  final int deliveredBoxes;
  final String createdAt;

  const Move({
    required this.id,
    required this.title,
    this.fromAddress,
    this.toAddress,
    required this.status,
    this.moveDate,
    required this.totalBoxes,
    required this.deliveredBoxes,
    required this.createdAt,
  });

  factory Move.fromJson(Map<String, dynamic> json) => Move(
        id: json['id'].toString(),
        title: (json['title'] as String?)?.isNotEmpty == true
            ? json['title'] as String
            : 'Unnamed Move',
        fromAddress: json['from_address'] as String?,
        toAddress: json['to_address'] as String?,
        status: (json['status'] as String?) ?? 'created',
        moveDate: json['move_date'] as String?,
        totalBoxes: int.tryParse(json['total_boxes']?.toString() ?? '0') ?? 0,
        deliveredBoxes:
            int.tryParse(json['delivered_boxes']?.toString() ?? '0') ?? 0,
        createdAt: (json['created_at'] as String?) ?? '',
      );
}