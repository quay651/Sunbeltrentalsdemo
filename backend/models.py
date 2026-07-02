"""
Database models for the Sunbelt Electrical Diagnostic Tool.

Core entities:
- Technician: the person using the tool
- Conversation: a diagnostic session/thread (can be 1:1 with AI or a shared
  multi-technician discussion thread)
- Message: an individual message in a conversation (text, AI response, or
  a message with an attached photo)
- Photo: uploaded images tied to a message, with AI vision analysis cached
- DiagnosticLog: a structured record of every diagnosis interaction, kept
  separately from raw chat so it's easy to query/export later for building
  a curated knowledge base or fine-tuning dataset down the line.
"""
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Technician(db.Model):
    __tablename__ = "technicians"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=True)
    role = db.Column(db.String(80), default="technician")  # technician, lead, admin
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    messages = db.relationship("Message", backref="author", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Conversation(db.Model):
    __tablename__ = "conversations"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False, default="Untitled Diagnosis")
    # 'private' = single technician <-> AI, 'shared' = team discussion thread
    conversation_type = db.Column(db.String(20), default="shared")
    equipment_type = db.Column(db.String(255), nullable=True)  # e.g. "Genie GRC-12 Lift"
    issue_category = db.Column(db.String(120), nullable=True)  # e.g. "relay", "fuse", "wiring"
    status = db.Column(db.String(20), default="open")  # open, resolved, archived
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    messages = db.relationship(
        "Message", backref="conversation", lazy=True, order_by="Message.created_at",
        cascade="all, delete-orphan"
    )

    def to_dict(self, include_messages=False):
        data = {
            "id": self.id,
            "title": self.title,
            "conversation_type": self.conversation_type,
            "equipment_type": self.equipment_type,
            "issue_category": self.issue_category,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "message_count": len(self.messages) if self.messages else 0,
        }
        if include_messages:
            data["messages"] = [m.to_dict() for m in self.messages]
        return data


class Message(db.Model):
    __tablename__ = "messages"

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey("conversations.id"), nullable=False)
    technician_id = db.Column(db.Integer, db.ForeignKey("technicians.id"), nullable=True)

    # 'technician' = human message, 'ai' = Claude's response, 'system' = system note
    sender_type = db.Column(db.String(20), nullable=False, default="technician")
    content = db.Column(db.Text, nullable=False)

    # If this message included a photo, link it
    photo_id = db.Column(db.Integer, db.ForeignKey("photos.id"), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    photo = db.relationship("Photo", backref="message", uselist=False, foreign_keys=[photo_id])

    def to_dict(self):
        return {
            "id": self.id,
            "conversation_id": self.conversation_id,
            "technician_id": self.technician_id,
            "technician_name": self.author.name if self.author else None,
            "sender_type": self.sender_type,
            "content": self.content,
            "photo": self.photo.to_dict() if self.photo else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Photo(db.Model):
    __tablename__ = "photos"

    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    filepath = db.Column(db.String(500), nullable=False)
    uploaded_by = db.Column(db.Integer, db.ForeignKey("technicians.id"), nullable=True)

    # Cached AI vision analysis so we don't re-analyze the same photo repeatedly
    ai_analysis = db.Column(db.Text, nullable=True)
    analyzed_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "filename": self.filename,
            "url": f"/api/photos/{self.id}/file",
            "ai_analysis": self.ai_analysis,
            "analyzed_at": self.analyzed_at.isoformat() if self.analyzed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class DiagnosticLog(db.Model):
    """
    Structured log of every diagnosis interaction. Kept separate from raw
    chat messages so this data is easy to export later for building a
    curated knowledge base, retrieval index, or fine-tuning dataset.

    For this demo, we just log everything -- no automated "self-improvement"
    logic runs against this yet. That's a deliberate scope decision.
    """
    __tablename__ = "diagnostic_logs"

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey("conversations.id"), nullable=True)
    technician_id = db.Column(db.Integer, db.ForeignKey("technicians.id"), nullable=True)

    equipment_type = db.Column(db.String(255), nullable=True)
    issue_category = db.Column(db.String(120), nullable=True)
    question = db.Column(db.Text, nullable=False)
    ai_response = db.Column(db.Text, nullable=False)

    # Manual service info that was found/used while answering, if any
    sources_used = db.Column(db.Text, nullable=True)  # JSON string of URLs/titles

    # Optional feedback field for the future -- not actively used yet
    was_helpful = db.Column(db.Boolean, nullable=True)
    resolution_notes = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "conversation_id": self.conversation_id,
            "technician_id": self.technician_id,
            "equipment_type": self.equipment_type,
            "issue_category": self.issue_category,
            "question": self.question,
            "ai_response": self.ai_response,
            "sources_used": self.sources_used,
            "was_helpful": self.was_helpful,
            "resolution_notes": self.resolution_notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
